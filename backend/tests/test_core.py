import socket
import importlib
import sys
import pytest
import datetime
import hashlib
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException
from app.database import Base
from app.models import (
    Business, Role, User, Category, Product, SerialNumber, Customer,
    Account, ExpenseCategory, Expense, EmiPlan
)
from app.services.pos_service import process_pos_sale
from app.services.emi_service import calculate_emi_plan_details, create_emi_installments
from app.services.emi_service import collect_emi_payment
from app.services.accounting_service import get_daily_cash_reconciliation_summary
from app.auth import _scope_user, hash_password, ActiveUserContext, require_role
from app.routers.auth import login
from app.routers.emi import collect_plan_emi
from app.routers.reports import get_sales_report
from app.schemas.auth import LoginRequest
from app.schemas.emi import CollectEmiRequest
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
    assert details["base_emi"] == 6750.0

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


def test_login_accepts_username_or_email_case_insensitively(test_db):
    user = test_db.query(User).filter(User.username == "owner").first()
    user.email = "owner@example.com"
    user.hashed_password = hash_password("owner123")
    test_db.commit()

    username_response = login(LoginRequest(username="OWNER", password="owner123"), test_db)
    email_response = login(LoginRequest(username="OWNER@EXAMPLE.COM", password="owner123"), test_db)

    assert username_response.user.id == user.id
    assert email_response.user.id == user.id
    assert username_response.access_token
    assert email_response.access_token
    assert username_response.user.pin is None


def test_legacy_password_is_upgraded_on_successful_login(test_db):
    user = test_db.query(User).filter(User.username == "owner").first()
    user.hashed_password = hashlib.sha256(b"owner123").hexdigest()
    test_db.commit()

    login(LoginRequest(username="owner", password="owner123"), test_db)

    assert user.hashed_password.startswith("pbkdf2_sha256$")


def test_emi_collection_rejects_cross_business_plan(test_db):
    primary = test_db.query(Business).first()
    other = Business(name="Other Store", phone="9000000000", city="Pune")
    test_db.add(other)
    test_db.flush()
    customer = Customer(business_id=other.id, name="Other Customer", phone="9000000001")
    test_db.add(customer)
    test_db.flush()
    plan = EmiPlan(
        business_id=other.id,
        sale_id=1,
        customer_id=customer.id,
        product_name="Other Product",
        total_sale_amount=1000.0,
        down_payment=0.0,
        financed_principal=1000.0,
        total_repayable=1000.0,
        emi_amount=1000.0,
        number_of_installments=1,
        first_due_date=datetime.date.today(),
        balance_remaining=1000.0
    )
    test_db.add(plan)
    test_db.commit()
    owner = test_db.query(User).filter(User.username == "owner").first()

    with pytest.raises(HTTPException) as denied:
        collect_plan_emi(
            plan.id,
            CollectEmiRequest(amount=10.0, payment_method="CASH"),
            test_db,
            ActiveUserContext(owner, primary.id)
        )

    assert denied.value.status_code == 404


def test_pos_rejects_overpayment(test_db):
    biz = test_db.query(Business).first()
    user = test_db.query(User).filter(User.username == "owner").first()
    prod = test_db.query(Product).first()
    serial = test_db.query(SerialNumber).first()

    with pytest.raises(ValueError, match="payments cannot exceed"):
        process_pos_sale(
            db=test_db,
            business_id=biz.id,
            user_id=user.id,
            user_name=user.full_name,
            user_role="OWNER",
            customer_data={"name": "Test", "phone": "9999999999"},
            items_data=[{"product_id": prod.id, "serial_number_id": serial.id, "unit_price": 100.0, "gst_rate": 0.0}],
            payments_data=[{"payment_method": "CASH", "amount": 101.0}]
        )


def test_login_rejects_invalid_password_and_empty_identifier(test_db):
    user = test_db.query(User).filter(User.username == "owner").first()
    user.hashed_password = hash_password("owner123")
    test_db.commit()

    with pytest.raises(HTTPException) as invalid_password:
        login(LoginRequest(username="owner", password="wrong"), test_db)
    with pytest.raises(HTTPException) as empty_identifier:
        login(LoginRequest(username="   ", password="owner123"), test_db)

    assert invalid_password.value.status_code == 401
    assert invalid_password.value.detail == "Invalid email or password"
    assert empty_identifier.value.status_code == 401
    assert empty_identifier.value.detail == "Invalid email or password"


def test_login_rejects_inactive_user(test_db):
    user = test_db.query(User).filter(User.username == "owner").first()
    user.hashed_password = hash_password("owner123")
    user.is_active = False
    test_db.commit()

    with pytest.raises(HTTPException) as inactive_user:
        login(LoginRequest(username="owner", password="owner123"), test_db)

    assert inactive_user.value.status_code == 403
    assert inactive_user.value.detail == "Your account is inactive"


def test_owner_only_role_checker_rejects_staff(test_db):
    owner = test_db.query(User).filter(User.username == "owner").first()
    staff = test_db.query(User).filter(User.username == "staff").first()
    owner_checker = require_role(["OWNER"])

    assert owner_checker(ActiveUserContext(owner, owner.business_id)).id == owner.id
    with pytest.raises(HTTPException) as denied:
        owner_checker(ActiveUserContext(staff, staff.business_id))

    assert denied.value.status_code == 403


def test_pos_emi_checkout_persists_selected_plan_and_schedule(test_db):
    biz = test_db.query(Business).first()
    user = test_db.query(User).filter(User.username == "owner").first()
    prod = test_db.query(Product).first()
    serial = test_db.query(SerialNumber).first()

    sale = process_pos_sale(
        db=test_db,
        business_id=biz.id,
        user_id=user.id,
        user_name=user.full_name,
        user_role="OWNER",
        customer_data={"name": "EMI Customer", "phone": "9999999999"},
        items_data=[{
            "product_id": prod.id,
            "serial_number_id": serial.id,
            "unit_price": 20000.0,
            "quantity": 1,
            "gst_rate": 0.0
        }],
        payments_data=[{"payment_method": "CASH", "amount": 5000.0}],
        emi_details={
            "number_of_installments": 6,
            "interest_rate": 0.0,
            "processing_fee": 500.0,
            "notes": "Test EMI"
        }
    )

    test_db.refresh(sale)
    plan = sale.emi_plan
    assert plan is not None
    assert plan.down_payment == 5000.0
    assert plan.financed_principal == 15000.0
    assert plan.total_repayable == 15500.0
    assert plan.emi_amount == 2583.33
    assert len(plan.installments) == 6
    assert round(sum(item.emi_amount for item in plan.installments), 2) == 15500.0


def test_emi_collection_rejects_duplicate_paid_installment(test_db):
    biz = test_db.query(Business).first()
    user = test_db.query(User).filter(User.username == "owner").first()
    prod = test_db.query(Product).first()
    serial = test_db.query(SerialNumber).first()
    sale = process_pos_sale(
        db=test_db,
        business_id=biz.id,
        user_id=user.id,
        user_name=user.full_name,
        user_role="OWNER",
        customer_data={"name": "Duplicate Test", "phone": "9888888888"},
        items_data=[{"product_id": prod.id, "serial_number_id": serial.id, "unit_price": 20000.0, "quantity": 1, "gst_rate": 0.0}],
        payments_data=[{"payment_method": "CASH", "amount": 5000.0}],
        emi_details={"number_of_installments": 6, "interest_rate": 0.0, "processing_fee": 0.0}
    )
    installment = sale.emi_plan.installments[0]

    collect_emi_payment(test_db, sale.emi_plan.id, installment.id, installment.balance_due, "CASH", None, user.id, datetime.date.today())
    with pytest.raises(ValueError, match="already paid"):
        collect_emi_payment(test_db, sale.emi_plan.id, installment.id, 1.0, "CASH", None, user.id, datetime.date.today())


def test_sales_report_filters_and_aggregates_products(test_db):
    biz = test_db.query(Business).first()
    user = test_db.query(User).filter(User.username == "owner").first()
    prod = test_db.query(Product).first()
    serial = test_db.query(SerialNumber).first()
    process_pos_sale(
        db=test_db,
        business_id=biz.id,
        user_id=user.id,
        user_name=user.full_name,
        user_role="OWNER",
        customer_data={"name": "Report Customer", "phone": "9777777777"},
        items_data=[{"product_id": prod.id, "serial_number_id": serial.id, "unit_price": 20000.0, "quantity": 1, "gst_rate": 0.0}],
        payments_data=[{"payment_method": "CASH", "amount": 20000.0}]
    )

    report = get_sales_report(
        start_date=datetime.date.today(),
        end_date=datetime.date.today(),
        brand=prod.brand,
        payment_method="CASH",
        db=test_db,
        current_user=ActiveUserContext(user, biz.id)
    )

    assert report["invoices_count"] == 1
    assert report["total_items_sold"] == 1
    assert report["cash_sales"] == 20000.0
    assert report["products"][0]["product_id"] == prod.id
    assert report["categories"][0]["quantity"] == 1

def test_owner_can_scope_to_another_store_but_staff_cannot(test_db):
    primary = test_db.query(Business).first()
    second = Business(name="Second Store", phone="9000000000", city="Pune")
    test_db.add(second)
    test_db.flush()
    owner = test_db.query(User).filter(User.username == "owner").first()
    staff = test_db.query(User).filter(User.username == "staff").first()

    scoped_owner = _scope_user(owner, str(second.id), test_db)
    assert scoped_owner.business_id == second.id
    assert scoped_owner.id == owner.id

    with pytest.raises(HTTPException) as exc:
        _scope_user(staff, str(second.id), test_db)
    assert exc.value.status_code == 403
    assert primary.id == owner.business_id


def test_main_auto_seeds_default_users_if_database_is_empty(monkeypatch):
    import app.seed as seed_module

    calls = {"count": 0}

    def fake_seed_database():
        calls["count"] += 1

    monkeypatch.setattr(seed_module, "seed_database", fake_seed_database)
    sys.modules.pop("app.main", None)

    import app.main as main_module

    assert calls["count"] == 1
    importlib.reload(main_module)
    assert calls["count"] == 2
