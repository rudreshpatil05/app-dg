import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.auth import User
from app.models.sale import Sale, SalePayment
from app.models.product import Product, SerialNumber
from app.models.party import Customer, Supplier
from app.models.emi import EmiInstallment, EmiPlan
from app.models.finance import Expense, Account
from app.models.specialized import RepairTicket, WarrantyRecord
from app.models.audit import Notification
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Business Analytics"], dependencies=[Depends(require_role(["OWNER", "MANAGER", "STAFF", "ACCOUNTANT"]))])

@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    biz_id = current_user.business_id
    role_code = current_user.role.code if current_user.role else "STAFF"
    is_staff = role_code == "STAFF"
    today = datetime.date.today()

    # 1. Today's Sales
    today_sales_query = db.query(
        func.coalesce(func.sum(Sale.grand_total), 0.0),
        func.count(Sale.id)
    ).filter(
        Sale.business_id == biz_id,
        Sale.status == "COMPLETED",
        Sale.invoice_date == today
    ).first()
    today_sales_total = float(today_sales_query[0])
    today_sales_count = int(today_sales_query[1])

    # 2. Today's Profit (Role-Based Restriction!)
    today_profit_val = None
    if not is_staff:
        today_profit = db.query(
            func.coalesce(func.sum(Sale.gross_profit), 0.0)
        ).filter(
            Sale.business_id == biz_id,
            Sale.status == "COMPLETED",
            Sale.invoice_date == today
        ).scalar()
        today_profit_val = float(today_profit)

    # 3. Today's Expenses
    today_expenses = db.query(
        func.coalesce(func.sum(Expense.amount), 0.0)
    ).filter(
        Expense.business_id == biz_id,
        Expense.expense_date == today
    ).scalar()

    # 4. Cash in Hand & Bank / UPI Balances
    cash_balance = db.query(
        func.coalesce(func.sum(Account.current_balance), 0.0)
    ).filter(
        Account.business_id == biz_id,
        Account.account_type == "CASH",
        Account.is_active == True
    ).scalar()

    bank_upi_balance = db.query(
        func.coalesce(func.sum(Account.current_balance), 0.0)
    ).filter(
        Account.business_id == biz_id,
        Account.account_type.in_(["BANK", "UPI", "CARD"]),
        Account.is_active == True
    ).scalar()

    # 5. Total Outstanding Customer Khata & EMI Due Today
    total_outstanding = db.query(
        func.coalesce(func.sum(Customer.current_balance), 0.0)
    ).filter(
        Customer.business_id == biz_id,
        Customer.current_balance > 0
    ).scalar()

    emi_due_today = db.query(
        func.coalesce(func.sum(EmiInstallment.balance_due), 0.0)
    ).filter(
        EmiInstallment.business_id == biz_id,
        EmiInstallment.status.in_(["PENDING", "OVERDUE", "PARTIAL"]),
        EmiInstallment.due_date == today
    ).scalar()

    # 6. Supplier Payable (What store owes to distributors)
    supplier_payable = db.query(
        func.coalesce(func.sum(Supplier.current_balance), 0.0)
    ).filter(
        Supplier.business_id == biz_id,
        Supplier.current_balance > 0
    ).scalar()

    # 7. Current Stock Valuation (masked if staff)
    stock_value_val = None
    if not is_staff:
        # Sum of purchase costs of all in-stock products
        serialized_val = db.query(
            func.coalesce(func.sum(SerialNumber.purchase_cost), 0.0)
        ).filter(
            SerialNumber.business_id == biz_id,
            SerialNumber.status == "IN_STOCK"
        ).scalar()

        non_serialized_val = db.query(
            func.coalesce(func.sum(Product.purchase_cost * Product.current_stock), 0.0)
        ).filter(
            Product.business_id == biz_id,
            Product.is_serialized == False
        ).scalar()

        stock_value_val = float(serialized_val + non_serialized_val)

    # 8. Sales Periods (Today, This Week, This Month)
    start_of_week = today - datetime.timedelta(days=today.weekday())
    start_of_month = today.replace(day=1)

    week_sales = db.query(func.coalesce(func.sum(Sale.grand_total), 0.0)).filter(
        Sale.business_id == biz_id,
        Sale.status == "COMPLETED",
        Sale.invoice_date >= start_of_week
    ).scalar()

    month_sales = db.query(func.coalesce(func.sum(Sale.grand_total), 0.0)).filter(
        Sale.business_id == biz_id,
        Sale.status == "COMPLETED",
        Sale.invoice_date >= start_of_month
    ).scalar()

    # 9. 7-Day Sales & Expense Trend Chart Data
    chart_days = []
    for i in range(6, -1, -1):
        d = today - datetime.timedelta(days=i)
        d_sales = db.query(func.coalesce(func.sum(Sale.grand_total), 0.0)).filter(
            Sale.business_id == biz_id,
            Sale.status == "COMPLETED",
            Sale.invoice_date == d
        ).scalar()
        d_expenses = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.business_id == biz_id,
            Expense.expense_date == d
        ).scalar()
        chart_days.append({
            "date": d.strftime("%d %b"),
            "sales": float(d_sales),
            "expenses": float(d_expenses)
        })

    # 10. Important Actionable Alerts
    low_stock_items = db.query(Product).filter(
        Product.business_id == biz_id,
        Product.current_stock <= Product.min_stock_level,
        Product.is_active == True
    ).all()

    overdue_emis = db.query(EmiInstallment).join(EmiPlan).join(Customer).filter(
        EmiInstallment.business_id == biz_id,
        EmiInstallment.status == "OVERDUE"
    ).all()

    pending_repairs = db.query(RepairTicket).filter(
        RepairTicket.business_id == biz_id,
        RepairTicket.status.in_(["RECEIVED", "DIAGNOSING", "REPAIRING", "READY"])
    ).all()

    expiring_warranties = db.query(WarrantyRecord).filter(
        WarrantyRecord.business_id == biz_id,
        WarrantyRecord.status == "ACTIVE",
        WarrantyRecord.warranty_end <= today + datetime.timedelta(days=15),
        WarrantyRecord.warranty_end >= today
    ).all()

    alerts = {
        "low_stock_count": len(low_stock_items),
        "low_stock_sample": [{"name": p.name, "stock": p.current_stock, "min": p.min_stock_level} for p in low_stock_items[:5]],
        "overdue_emi_count": len(overdue_emis),
        "pending_repairs_count": len(pending_repairs),
        "expiring_warranties_count": len(expiring_warranties)
    }

    # 11. Product & Brand Insights
    top_brands_query = db.query(
        Product.brand,
        func.count(Sale.id).label("sales_count"),
        func.sum(Sale.grand_total).label("total_rev")
    ).join(Sale, Product.id == Sale.id).group_by(Product.brand).limit(5).all()

    return {
        "kpis": {
            "today_sales": today_sales_total,
            "today_sales_count": today_sales_count,
            "today_profit": today_profit_val,
            "today_expenses": float(today_expenses),
            "cash_in_hand": float(cash_balance),
            "bank_upi_balance": float(bank_upi_balance),
            "total_customer_outstanding": float(total_outstanding),
            "customer_emi_due_today": float(emi_due_today),
            "supplier_payable": float(supplier_payable),
            "current_stock_value": stock_value_val,
            "is_profit_hidden": is_staff
        },
        "sales_overview": {
            "today": today_sales_total,
            "this_week": float(week_sales),
            "this_month": float(month_sales)
        },
        "trends": chart_days,
        "alerts": alerts
    }
