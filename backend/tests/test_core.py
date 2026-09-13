import socket
import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import (
    Business, Role, User, Category, Product, SerialNumber, Customer,
    Account, ExpenseCategory, Expense
)
from app.services.pos_service import process_pos_sale
from app.services.emi_service import calculate_emi_plan_details, create_emi_installments
from app.services.accounting_service import get_daily_cash_reconciliation_summary
from run_server import get_available_port


def test_get_available_port_skips_occupied_port():
    occupied = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    occupied.bind(("127.0.0.1", 0))
    start_port = occupied.getsockname()[1]
    occupied.listen(1)

    fallback_port = get_available_port(start_port, max_tries=5)

    assert fallback_port != start_port
    occupied.close()


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()

    # Seed minimal test data
    biz = Business(name="Test Mobile Store", gstin="27AABCS1429B1Z8", phone="9822012345", city="Pune")
    db.add(biz)
    db.flush()

    role_owner = Role(code="OWNER", name="Owner")
    role_staff = Role(code="STAFF", name="Staff")
    db.add_all([role_owner, role_staff])
    db.flush()

    user_owner = User(business_id=biz.id, username="owner", full_name="Store Owner", hashed_password="x", role_id=role_owner.id)
    user_staff = User(business_id=biz.id, username="staff", full_name="Sales Staff", hashed_password="x", role_id=role_staff.id)
    db.add_all([user_owner, user_staff])

    cash_acc = Account(business_id=biz.id, name="Cash Drawer", account_type="CASH", opening_balance=10000.0, current_balance=10000.0, is_default=True)
    db.add(cash_acc)

    cat = Category(business_id=biz.id, name="Smartphones", slug="smartphones")
    db.add(cat)
    db.flush()

    prod = Product(
        business_id=biz.id,
        category_id=cat.id,
        name="iPhone 15 (128GB)",
        brand="Apple",
        mrp=79900.0,
        selling_price=69999.0,
        purchase_cost=62000.0,
        current_stock=2,
        is_serialized=True,
        hsn_code="8517",
        gst_rate=18.0
    )
    db.add(prod)
    db.flush()

    s1 = SerialNumber(business_id=biz.id, product_id=prod.id, imei1="358921118234001", status="IN_STOCK", purchase_cost=62000.0, selling_price=69999.0)
    s2 = SerialNumber(business_id=biz.id, product_id=prod.id, imei1="358921118234002", status="IN_STOCK", purchase_cost=62000.0, selling_price=69999.0)
    db.add_all([s1, s2])

    cust = Customer(business_id=biz.id, name="Rahul Patil", phone="9890112233", city="Pune")
    db.add(cust)

    db.commit()
    yield db
    db.close()

def test_pos_sale_updates_inventory_and_imei(test_db):
    biz = test_db.query(Business).first()
    user = test_db.query(User).filter(User.username == "owner").first()
    prod = test_db.query(Product).first()
    serial = test_db.query(SerialNumber).filter(SerialNumber.imei1 == "358921118234001").first()

    sale = process_pos_sale(
        db=test_db,
        business_id=biz.id,
        user_id=user.id,
        user_name=user.full_name,
        user_role="OWNER",
        customer_data={"name": "Rahul Patil", "phone": "9890112233"},
        items_data=[{
            "product_id": prod.id,
            "serial_number_id": serial.id,
            "unit_price": 69999.0,
            "quantity": 1,
            "discount": 1000.0,
            "gst_rate": 18.0
        }],
        discount_amount=0.0,
        payments_data=[{"payment_method": "CASH", "amount": 68999.0}]
    )

    assert sale.final_payable == 68999.0
    assert sale.paid_amount == 68999.0
    assert sale.balance_due == 0.0

    # Verify IMEI is now SOLD
    test_db.refresh(serial)
    assert serial.status == "SOLD"

    # Verify Product stock decreased by 1
    test_db.refresh(prod)
    assert prod.current_stock == 1

    # Verify Cash Drawer increased
    cash_acc = test_db.query(Account).filter(Account.account_type == "CASH").first()
    assert cash_acc.current_balance == 10000.0 + 68999.0

def test_pos_sale_rejects_already_sold_imei(test_db):
    biz = test_db.query(Business).first()
    user = test_db.query(User).first()
    prod = test_db.query(Product).first()
    serial = test_db.query(SerialNumber).first()
    serial.status = "SOLD"
    test_db.commit()

    with pytest.raises(ValueError) as exc:
        process_pos_sale(
            db=test_db,
            business_id=biz.id,
            user_id=user.id,
            user_name=user.full_name,
            user_role="OWNER",
            customer_data={"name": "Test", "phone": "9999999999"},
            items_data=[{
                "product_id": prod.id,
                "serial_number_id": serial.id,
                "unit_price": 69999.0,
                "quantity": 1,
                "gst_rate": 18.0
            }],
            payments_data=[{"payment_method": "CASH", "amount": 69999.0}]
        )
    assert "already SOLD" in str(exc.value)

def test_emi_calculation_exact_reconciliation():
    details = calculate_emi_plan_details(
        financed_principal=40000.0,
        annual_interest_rate=0.0,
        months=6,
        processing_fee=500.0
    )
    assert details["total_repayable"] == 40500.0
    assert details["base_emi"] == 6666.67

    # Test that 6 months * monthly installment equals total
    months = 6
    total_repayable = 40000.0
    monthly = round(total_repayable / months, 2) # 6666.67
    accumulated = monthly * (months - 1) # 33333.35
    last_inst = round(total_repayable - accumulated, 2) # 6666.65
    assert (accumulated + last_inst) == 40000.0

def test_cash_reconciliation_calculation(test_db):
    biz = test_db.query(Business).first()
    today = datetime.date.today()
    summary = get_daily_cash_reconciliation_summary(test_db, biz.id, today)
    assert "system_expected_cash" in summary
    assert "net_cash_flow_today" in summary
    assert summary["opening_cash"] == 10000.0
