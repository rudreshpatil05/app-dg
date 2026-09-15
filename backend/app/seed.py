import datetime
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import (
    Business, Role, User, Category, Product, ProductVariant, SerialNumber,
    Customer, CustomerLedger, Supplier, SupplierLedger,
    Account, AccountTransaction, ExpenseCategory, Expense,
    Sale, SaleItem, SalePayment, EmiPlan, EmiInstallment, EmiPayment,
    ExchangeDevice, WarrantyRecord, RepairTicket, Notification, AuditLog
)
from app.auth import hash_password

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Check if already seeded
    if db.query(Business).first():
        print("Database already contains records. Skipping seed.")
        db.close()
        return

    print("Seeding Indian Mobile & Electronics Retail Store Database...")

    # 1. Business
    biz = Business(
        name="DG Mobile and Electronics",
        legal_name="DG Mobile and Electronics",
        gstin="27AABCS1429B1Z8",
        phone="9822012345",
        alternate_phone="02025531234",
        email="shreeganeshmobile.pune@gmail.com",
        address="Near ST Stand, Roha",
        city="Roha",
        state="Maharashtra",
        state_code="27",
        pincode="411004",
        upi_id="shreeganesh@icici",
        invoice_prefix="SGM",
        thermal_printer_width="80mm",
        terms_and_conditions="1. Goods once sold will not be taken back without original bill.\n2. Warranty handled by brand authorized service centers.\n3. Physical and liquid damage not covered under warranty."
    )
    db.add(biz)
    db.flush()

    # 2. Roles
    roles_data = [
        {"code": "OWNER", "name": "Store Owner", "description": "Full access to all operations, profits, expenses, staff, and financial settings"},
        {"code": "MANAGER", "name": "Store Manager", "description": "Sales, purchases, inventory, customers, suppliers, and operational reports"},
        {"code": "STAFF", "name": "Sales Counter Staff", "description": "Fast POS billing, customer intake, available stock viewing, payment collection"},
        {"code": "ACCOUNTANT", "name": "Store Accountant", "description": "Financial ledgers, cash/bank reconciliation, GST reports, and expenses"}
    ]
    role_map = {}
    for r in roles_data:
        role_obj = Role(**r)
        db.add(role_obj)
        db.flush()
        role_map[r["code"]] = role_obj

    # 3. Users
    users_data = [
        {"username": "rajesh", "full_name": "Rajesh Patil (Owner)", "email": "rajesh@shreeganesh.com", "role_id": role_map["OWNER"].id, "phone": "9822012345", "pin": "1234"},
        {"username": "suresh", "full_name": "Suresh Deshmukh (Manager)", "email": "suresh@shreeganesh.com", "role_id": role_map["MANAGER"].id, "phone": "9822098765", "pin": "2222"},
        {"username": "amit", "full_name": "Amit Shinde (Sales Staff)", "email": "amit@shreeganesh.com", "role_id": role_map["STAFF"].id, "phone": "9765432100", "pin": "3333"},
        {"username": "pooja", "full_name": "Pooja Joshi (Accountant)", "email": "pooja@shreeganesh.com", "role_id": role_map["ACCOUNTANT"].id, "phone": "9881122334", "pin": "4444"}
    ]
    user_map = {}
    for u in users_data:
        pwd_hash = hash_password(f"{u['username']}123")
        user_obj = User(
            business_id=biz.id,
            username=u["username"],
            hashed_password=pwd_hash,
            full_name=u["full_name"],
            email=u["email"],
            role_id=u["role_id"],
            phone=u["phone"],
            pin=u["pin"]
        )
        db.add(user_obj)
        db.flush()
        user_map[u["username"]] = user_obj

    # 4. Accounts
    cash_acc = Account(
        business_id=biz.id,
        name="Main Cash Drawer (Counter 1)",
        account_type="CASH",
        opening_balance=25000.0,
        current_balance=48500.0,
        is_default=True
    )
    bank_acc = Account(
        business_id=biz.id,
        name="HDFC Bank Current A/C",
        account_type="BANK",
        account_number="50200034891234",
        bank_name="HDFC Bank",
        ifsc_code="HDFC0000039",
        opening_balance=150000.0,
        current_balance=245000.0
    )
    upi_acc = Account(
        business_id=biz.id,
        name="Shop UPI (PhonePe / Google Pay QR)",
        account_type="UPI",
        upi_id="shreeganesh@icici",
        opening_balance=10000.0,
        current_balance=88200.0
    )
    db.add_all([cash_acc, bank_acc, upi_acc])
    db.flush()

    # 5. Expense Categories
    exp_cats = [
        "Shop Rent", "Electricity & Utilities", "Staff Salaries", "Tea & Refreshments",
        "Packaging & Carry Bags", "Advertising & Marketing", "Store Maintenance", "Internet & Tech"
    ]
    cat_objs = {}
    for c in exp_cats:
        c_obj = ExpenseCategory(business_id=biz.id, name=c)
        db.add(c_obj)
        db.flush()
        cat_objs[c] = c_obj

    # Seed Sample Expenses
    today = datetime.date.today()
    expenses_data = [
        {"category_id": cat_objs["Shop Rent"].id, "amount": 35000.0, "expense_date": today.replace(day=1), "payment_method": "BANK", "vendor": "Shreeram Complex Management"},
        {"category_id": cat_objs["Electricity & Utilities"].id, "amount": 4200.0, "expense_date": today.replace(day=5), "payment_method": "UPI", "vendor": "MSEDCL"},
        {"category_id": cat_objs["Tea & Refreshments"].id, "amount": 1450.0, "expense_date": today, "payment_method": "CASH", "vendor": "Sai Krupa Tea Center"},
        {"category_id": cat_objs["Packaging & Carry Bags"].id, "amount": 2800.0, "expense_date": today - datetime.timedelta(days=2), "payment_method": "CASH", "vendor": "Apex Packaging Pune"}
    ]
    for exp in expenses_data:
        e = Expense(business_id=biz.id, account_id=cash_acc.id if exp["payment_method"]=="CASH" else bank_acc.id, **exp)
        db.add(e)

    # 6. Categories
    categories_data = [
        {"name": "Smartphones", "slug": "smartphones", "description": "iOS and Android mobile devices"},
        {"name": "Tablets & iPads", "slug": "tablets", "description": "Apple iPad, Samsung Galaxy Tab, etc."},
        {"name": "Smart Watches", "slug": "smart-watches", "description": "Apple Watch, Noise, boAt, Fire-Boltt"},
        {"name": "Earbuds & Audio", "slug": "earbuds", "description": "TWS Earbuds, Neckbands, Headphones"},
        {"name": "Chargers & Cables", "slug": "chargers-cables", "description": "Fast adapters, braided type-C cables"},
        {"name": "Covers & Protection", "slug": "covers-protection", "description": "Tempered glass, armor cases"},
        {"name": "Power Banks", "slug": "power-banks", "description": "10000mAh & 20000mAh power banks"}
    ]
    category_map = {}
    for cat in categories_data:
        c_obj = Category(business_id=biz.id, **cat)
        db.add(c_obj)
        db.flush()
        category_map[cat["slug"]] = c_obj

    # 7. Suppliers
    suppliers_data = [
        {"name": "Ramesh Jain", "company": "ABC Telecom Distributors", "phone": "9822446688", "city": "Pune", "gstin": "27AAACA1234A1Z1", "current_balance": 145000.0},
        {"name": "Mahesh Shah", "company": "BrightPoint National Distribution", "phone": "9819876543", "city": "Mumbai", "gstin": "27AABCB9876B1Z2", "current_balance": 85000.0},
        {"name": "Anil Kulkarni", "company": "TechSource Accessories Hub", "phone": "9970112233", "city": "Pune", "gstin": "27AADCS5544C1Z3", "current_balance": 18200.0}
    ]
    supplier_map = {}
    for s in suppliers_data:
        s_obj = Supplier(business_id=biz.id, **s)
        db.add(s_obj)
        db.flush()
        supplier_map[s["company"]] = s_obj

    # 8. Products & Serial Numbers (IMEIs)
    products_seed = [
        {
            "name": "Apple iPhone 15 Pro (128GB)",
            "brand": "Apple",
            "model": "iPhone 15 Pro",
            "category_id": category_map["smartphones"].id,
            "hsn_code": "8517",
            "gst_rate": 18.0,
            "mrp": 134900.0,
            "selling_price": 127999.0,
            "purchase_cost": 118500.0,
            "current_stock": 4,
            "is_serialized": True,
            "warranty_months": 12,
            "imeis": [
                ("358921118234561", "358921118234562", "DN6K2091MD6P", "Natural Titanium", "8GB", "128GB"),
                ("358921118234563", "358921118234564", "DN6K2092MD6P", "Black Titanium", "8GB", "128GB"),
                ("358921118234565", "358921118234566", "DN6K2093MD6P", "Blue Titanium", "8GB", "128GB"),
                ("358921118234567", "358921118234568", "DN6K2094MD6P", "White Titanium", "8GB", "128GB")
            ]
        },
        {
            "name": "Samsung Galaxy S24 Ultra (256GB)",
            "brand": "Samsung",
            "model": "Galaxy S24 Ultra",
            "category_id": category_map["smartphones"].id,
            "hsn_code": "8517",
            "gst_rate": 18.0,
            "mrp": 134999.0,
            "selling_price": 124999.0,
            "purchase_cost": 112000.0,
            "current_stock": 3,
            "is_serialized": True,
            "warranty_months": 12,
            "imeis": [
                ("864921049218201", "864921049218202", "R5CW2001XLP", "Titanium Gray", "12GB", "256GB"),
                ("864921049218203", "864921049218204", "R5CW2002XLP", "Titanium Black", "12GB", "256GB"),
                ("864921049218205", "864921049218206", "R5CW2003XLP", "Titanium Violet", "12GB", "256GB")
            ]
        },
        {
            "name": "OnePlus 12 5G (16GB / 512GB)",
            "brand": "OnePlus",
            "model": "OnePlus 12",
            "category_id": category_map["smartphones"].id,
            "hsn_code": "8517",
            "gst_rate": 18.0,
            "mrp": 69999.0,
            "selling_price": 64999.0,
            "purchase_cost": 58500.0,
            "current_stock": 3,
            "is_serialized": True,
            "warranty_months": 12,
            "imeis": [
                ("861029061122331", "861029061122332", "OP12019921", "Silky Black", "16GB", "512GB"),
                ("861029061122333", "861029061122334", "OP12019922", "Flowy Emerald", "16GB", "512GB"),
                ("861029061122335", "861029061122336", "OP12019923", "Silky Black", "16GB", "512GB")
            ]
        },
        {
            "name": "Redmi Note 13 Pro 5G (8GB / 128GB)",
            "brand": "Xiaomi",
            "model": "Redmi Note 13 Pro",
            "category_id": category_map["smartphones"].id,
            "hsn_code": "8517",
            "gst_rate": 18.0,
            "mrp": 28999.0,
            "selling_price": 24999.0,
            "purchase_cost": 21800.0,
            "current_stock": 5,
            "is_serialized": True,
            "warranty_months": 12,
            "imeis": [
                ("869911223344101", "869911223344102", "RN13P001", "Midnight Black", "8GB", "128GB"),
                ("869911223344103", "869911223344104", "RN13P002", "Coral Purple", "8GB", "128GB"),
                ("869911223344105", "869911223344106", "RN13P003", "Arctic White", "8GB", "128GB"),
                ("869911223344107", "869911223344108", "RN13P004", "Midnight Black", "8GB", "128GB"),
                ("869911223344109", "869911223344110", "RN13P005", "Coral Purple", "8GB", "128GB")
            ]
        },
        {
            "name": "boAt Airdopes 141 ANC TWS",
            "brand": "boAt",
            "model": "Airdopes 141 ANC",
            "category_id": category_map["earbuds"].id,
            "hsn_code": "8518",
            "gst_rate": 18.0,
            "mrp": 3990.0,
            "selling_price": 1499.0,
            "purchase_cost": 950.0,
            "current_stock": 25,
            "is_serialized": False,
            "warranty_months": 12,
            "barcode": "8904321098765"
        },
        {
            "name": "Apple 20W USB-C Power Adapter",
            "brand": "Apple",
            "model": "20W Adapter",
            "category_id": category_map["chargers-cables"].id,
            "hsn_code": "8504",
            "gst_rate": 18.0,
            "mrp": 1900.0,
            "selling_price": 1799.0,
            "purchase_cost": 1350.0,
            "current_stock": 18,
            "is_serialized": False,
            "warranty_months": 12,
            "barcode": "194252157007"
        },
        {
            "name": "Noise ColorFit Pulse 3 Smartwatch",
            "brand": "Noise",
            "model": "Pulse 3",
            "category_id": category_map["smart-watches"].id,
            "hsn_code": "8517",
            "gst_rate": 18.0,
            "mrp": 4999.0,
            "selling_price": 1999.0,
            "purchase_cost": 1300.0,
            "current_stock": 8,
            "is_serialized": True,
            "warranty_months": 12,
            "imeis": [
                (None, None, "NCFP001928", "Jet Black", None, None),
                (None, None, "NCFP001929", "Rose Pink", None, None),
                (None, None, "NCFP001930", "Silver Gray", None, None)
            ]
        },
        {
            "name": "Spigen Liquid Air Case for iPhone 15",
            "brand": "Spigen",
            "model": "Liquid Air",
            "category_id": category_map["covers-protection"].id,
            "hsn_code": "3926",
            "gst_rate": 18.0,
            "mrp": 1999.0,
            "selling_price": 1299.0,
            "purchase_cost": 650.0,
            "current_stock": 14,
            "is_serialized": False,
            "warranty_months": 6,
            "barcode": "8809896740012"
        }
    ]

    product_lookup = {}
    for p_info in products_seed:
        imeis = p_info.pop("imeis", [])
        p_obj = Product(business_id=biz.id, **p_info)
        db.add(p_obj)
        db.flush()
        product_lookup[p_obj.name] = p_obj

        for imei_tuple in imeis:
            s_obj = SerialNumber(
                business_id=biz.id,
                product_id=p_obj.id,
                imei1=imei_tuple[0],
                imei2=imei_tuple[1],
                serial_number=imei_tuple[2],
                color=imei_tuple[3],
                ram=imei_tuple[4],
                storage=imei_tuple[5],
                purchase_cost=p_obj.purchase_cost,
                selling_price=p_obj.selling_price,
                status="IN_STOCK",
                supplier_id=supplier_map["ABC Telecom Distributors"].id
            )
            db.add(s_obj)

    # 9. Customers with Khatabook Ledgers & EMIs
    customers_data = [
        {"name": "Rahul Patil", "phone": "9890112233", "city": "Pune", "current_balance": 18500.0, "total_purchases": 84999.0, "total_paid": 66499.0},
        {"name": "Priya Sharma", "phone": "9823445566", "city": "Pune", "current_balance": 24000.0, "total_purchases": 64999.0, "total_paid": 40999.0},
        {"name": "Amit Verma", "phone": "9765114477", "city": "Pimpri", "current_balance": 0.0, "total_purchases": 26798.0, "total_paid": 26798.0},
        {"name": "Sneha Kulkarni", "phone": "9881223344", "city": "Pune", "current_balance": 4500.0, "total_purchases": 14500.0, "total_paid": 10000.0}
    ]
    cust_map = {}
    for c in customers_data:
        c_obj = Customer(business_id=biz.id, **c)
        db.add(c_obj)
        db.flush()
        cust_map[c["name"]] = c_obj

        # Khatabook Ledger entries for Rahul Patil
        if c["name"] == "Rahul Patil":
            l1 = CustomerLedger(
                business_id=biz.id, customer_id=c_obj.id, entry_type="SALE",
                debit=84999.0, credit=30000.0, balance=54999.0, payment_method="SPLIT",
                notes="OnePlus 12 5G Purchase (Paid ₹30,000 via UPI)"
            )
            l2 = CustomerLedger(
                business_id=biz.id, customer_id=c_obj.id, entry_type="PAYMENT",
                debit=0.0, credit=20000.0, balance=34999.0, payment_method="CASH",
                notes="Counter Cash Payment received"
            )
            l3 = CustomerLedger(
                business_id=biz.id, customer_id=c_obj.id, entry_type="PAYMENT",
                debit=0.0, credit=16499.0, balance=18500.0, payment_method="UPI",
                notes="Google Pay collection"
            )
            db.add_all([l1, l2, l3])

    # 10. Sample Completed Sale with Warranty
    sample_sale = Sale(
        business_id=biz.id,
        customer_id=cust_map["Amit Verma"].id,
        user_id=user_map["amit"].id,
        invoice_number=f"{biz.invoice_prefix}-{today.strftime('%Y%m%d')}-0001",
        invoice_date=today,
        is_gst_invoice=True,
        customer_name="Amit Verma",
        customer_phone="9765114477",
        subtotal=26798.0,
        discount_amount=0.0,
        taxable_amount=22710.17,
        cgst_amount=2043.91,
        sgst_amount=2043.91,
        total_tax=4087.83,
        grand_total=26798.0,
        final_payable=26798.0,
        paid_amount=26798.0,
        balance_due=0.0,
        payment_status="PAID",
        payment_type="SPLIT",
        total_cogs=23150.0,
        gross_profit=3648.0,
        status="COMPLETED"
    )
    db.add(sample_sale)
    db.flush()

    sp1 = SalePayment(business_id=biz.id, sale_id=sample_sale.id, amount=10000.0, payment_method="CASH", account_id=cash_acc.id)
    sp2 = SalePayment(business_id=biz.id, sale_id=sample_sale.id, amount=16798.0, payment_method="UPI", reference_number="UPI490192841029", account_id=upi_acc.id)
    db.add_all([sp1, sp2])

    w_rec = WarrantyRecord(
        business_id=biz.id,
        sale_id=sample_sale.id,
        customer_id=cust_map["Amit Verma"].id,
        product_id=product_lookup["Redmi Note 13 Pro 5G (8GB / 128GB)"].id,
        imei="869911223344101",
        product_name="Redmi Note 13 Pro 5G",
        customer_name="Amit Verma",
        customer_phone="9765114477",
        purchase_date=today,
        warranty_months=12,
        warranty_start=today,
        warranty_end=today + datetime.timedelta(days=365),
        status="ACTIVE"
    )
    db.add(w_rec)

    # 11. Active Store-Financed EMI Scheme for Priya Sharma
    emi_plan = EmiPlan(
        business_id=biz.id,
        sale_id=sample_sale.id,
        customer_id=cust_map["Priya Sharma"].id,
        product_name="OnePlus 12 5G (Silky Black)",
        imei="861029061122331",
        total_sale_amount=64999.0,
        down_payment=25000.0,
        financed_principal=39999.0,
        interest_rate=0.0, # 0% Interest promotional scheme
        interest_amount=0.0,
        processing_fee=500.0,
        total_repayable=40499.0,
        emi_amount=6750.0,
        number_of_installments=6,
        first_due_date=today - datetime.timedelta(days=60),
        total_paid=13500.0,
        balance_remaining=26999.0,
        status="ACTIVE"
    )
    db.add(emi_plan)
    db.flush()

    # 6 Installments (Month 1 & 2 PAID, Month 3 OVERDUE, Months 4-6 PENDING)
    inst_dates = [
        today - datetime.timedelta(days=60),
        today - datetime.timedelta(days=30),
        today,
        today + datetime.timedelta(days=30),
        today + datetime.timedelta(days=60),
        today + datetime.timedelta(days=90)
    ]
    for idx, d in enumerate(inst_dates, 1):
        if idx <= 2:
            st = "PAID"
            p_amt = 6750.0
            b_due = 0.0
            p_date = d
        elif idx == 3:
            st = "OVERDUE"
            p_amt = 0.0
            b_due = 6750.0
            p_date = None
        else:
            st = "PENDING"
            p_amt = 0.0
            b_due = 6749.0 if idx == 6 else 6750.0
            p_date = None

        inst = EmiInstallment(
            business_id=biz.id,
            emi_plan_id=emi_plan.id,
            installment_number=idx,
            due_date=d,
            emi_amount=6749.0 if idx == 6 else 6750.0,
            paid_amount=p_amt,
            balance_due=b_due,
            paid_date=p_date,
            status=st
        )
        db.add(inst)

    # 12. Repair Tickets
    repairs = [
        RepairTicket(
            business_id=biz.id,
            ticket_number="REP-2026-0089",
            customer_name="Sanjay Kadam",
            customer_phone="9822778899",
            device_name="Samsung Galaxy S22 5G",
            imei_or_serial="865911002233441",
            problem_description="AMOLED display cracked after drop, touch partially unresponsive",
            accessories_received="Handset only",
            estimated_cost=7500.0,
            final_cost=7500.0,
            advance_paid=2000.0,
            technician_name="Mahesh (Senior Tech)",
            status="DIAGNOSING",
            received_date=today - datetime.timedelta(days=1),
            expected_completion=today + datetime.timedelta(days=2)
        ),
        RepairTicket(
            business_id=biz.id,
            ticket_number="REP-2026-0090",
            customer_name="Kavita Deshmukh",
            customer_phone="9890445511",
            device_name="OnePlus 10 Pro",
            imei_or_serial="860129031122339",
            problem_description="Battery draining rapidly, sudden shutdowns at 20%",
            accessories_received="Handset with back cover",
            estimated_cost=2800.0,
            final_cost=2800.0,
            advance_paid=1000.0,
            technician_name="Vinod Tech",
            status="READY",
            received_date=today - datetime.timedelta(days=3),
            completed_date=today
        )
    ]
    db.add_all(repairs)

    # 13. Old Mobile Exchange Device in Stock
    ex_dev = ExchangeDevice(
        business_id=biz.id,
        brand="OnePlus",
        model="Nord CE 2 5G",
        imei="860921041122991",
        ram="8GB",
        storage="128GB",
        color="Bahamas Blue",
        age_months=18,
        screen_condition="Minor Scratches",
        body_condition="Good",
        battery_health="82%",
        accessories_included="Original 65W Charger & Box",
        estimated_value=8500.0,
        final_exchange_value=8000.0,
        status="RESALE",
        resale_price=11000.0,
        notes="Inspected and cleaned. Fully operational. Display tested."
    )
    db.add(ex_dev)

    # 14. Notifications & Alerts
    alerts = [
        Notification(business_id=biz.id, title="Low Stock Warning", message="Noise ColorFit Pulse 3 Smartwatch has only 3 units remaining!", category="LOW_STOCK", severity="WARNING"),
        Notification(business_id=biz.id, title="EMI Payment Overdue", message="Priya Sharma: Installment #3 for OnePlus 12 (₹6,750) is due today!", category="EMI_DUE", severity="DANGER"),
        Notification(business_id=biz.id, title="Repair Ready for Pickup", message="OnePlus 10 Pro (Kavita Deshmukh) battery replacement is READY for delivery.", category="REPAIR_READY", severity="INFO")
    ]
    db.add_all(alerts)

    # 15. Audit Log
    audit = AuditLog(
        business_id=biz.id,
        user_id=user_map["rajesh"].id,
        user_name=user_map["rajesh"].full_name,
        role="OWNER",
        action="SYSTEM_INITIALIZATION",
        entity_type="Business",
        entity_id=biz.id,
        notes="Initial store setup, stock catalog and accounts configured."
    )
    db.add(audit)

    db.commit()
    db.close()
    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_database()
