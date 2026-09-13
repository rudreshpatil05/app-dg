import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.sale import Sale, SalePayment
from app.models.purchase import Purchase
from app.models.finance import Expense, Account, AccountTransaction, CashReconciliation
from app.models.emi import EmiPayment
from app.models.party import CustomerLedger

def get_daily_cash_reconciliation_summary(
    db: Session,
    business_id: int,
    target_date: datetime.date
) -> dict:
    """
    Computes system cash balance vs physical cash for daily counter handover.
    """
    # 1. Cash Sales
    cash_sales = db.query(func.coalesce(func.sum(SalePayment.amount), 0.0)).filter(
        SalePayment.business_id == business_id,
        SalePayment.payment_method == "CASH",
        func.date(SalePayment.created_at) == target_date
    ).scalar()

    # 2. Cash EMI Payments
    emi_cash = db.query(func.coalesce(func.sum(EmiPayment.amount), 0.0)).filter(
        EmiPayment.business_id == business_id,
        EmiPayment.payment_method == "CASH",
        EmiPayment.payment_date == target_date
    ).scalar()

    # 3. Cash Received from Customer Khata (non-sale payments)
    khata_cash = db.query(func.coalesce(func.sum(CustomerLedger.credit), 0.0)).filter(
        CustomerLedger.business_id == business_id,
        CustomerLedger.payment_method == "CASH",
        CustomerLedger.entry_type == "PAYMENT",
        func.date(CustomerLedger.created_at) == target_date
    ).scalar()

    # 4. Cash Expenses
    cash_expenses = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
        Expense.business_id == business_id,
        Expense.payment_method == "CASH",
        Expense.expense_date == target_date
    ).scalar()

    # 5. Cash Paid to Suppliers
    supplier_cash = db.query(func.coalesce(func.sum(Purchase.paid_amount), 0.0)).filter(
        Purchase.business_id == business_id,
        Purchase.payment_method == "CASH",
        Purchase.invoice_date == target_date
    ).scalar()

    # Default Cash Account
    cash_account = db.query(Account).filter(
        Account.business_id == business_id,
        Account.account_type == "CASH",
        Account.is_active == True
    ).first()

    opening_cash = cash_account.opening_balance if cash_account else 0.0
    current_system_cash = cash_account.current_balance if cash_account else 0.0

    net_cash_flow_today = (cash_sales + emi_cash + khata_cash) - (cash_expenses + supplier_cash)

    return {
        "date": target_date.isoformat(),
        "opening_cash": opening_cash,
        "cash_sales": float(cash_sales),
        "emi_cash_collected": float(emi_cash),
        "customer_cash_collected": float(khata_cash),
        "cash_expenses": float(cash_expenses),
        "supplier_cash_paid": float(supplier_cash),
        "net_cash_flow_today": float(net_cash_flow_today),
        "system_expected_cash": float(current_system_cash)
    }

def record_cash_reconciliation(
    db: Session,
    business_id: int,
    user_id: int,
    target_date: datetime.date,
    actual_physical_cash: float,
    notes: str | None = None
) -> CashReconciliation:
    summary = get_daily_cash_reconciliation_summary(db, business_id, target_date)
    expected = summary["system_expected_cash"]
    discrepancy = round(actual_physical_cash - expected, 2)
    status = "MATCHED" if abs(discrepancy) < 1.0 else "DISCREPANCY"

    recon = CashReconciliation(
        business_id=business_id,
        reconciliation_date=target_date,
        user_id=user_id,
        opening_cash=summary["opening_cash"],
        cash_sales=summary["cash_sales"],
        customer_cash_collected=summary["customer_cash_collected"],
        emi_cash_collected=summary["emi_cash_collected"],
        cash_expenses=summary["cash_expenses"],
        supplier_cash_paid=summary["supplier_cash_paid"],
        system_expected_cash=expected,
        actual_physical_cash=actual_physical_cash,
        discrepancy=discrepancy,
        status=status,
        notes=notes
    )
    db.add(recon)
    db.commit()
    db.refresh(recon)
    return recon

def calculate_comprehensive_profit_loss(
    db: Session,
    business_id: int,
    start_date: datetime.date,
    end_date: datetime.date
) -> dict:
    """
    Computes True Revenue, COGS, Gross Profit, Total Expenses, and Net Profit.
    """
    sales = db.query(Sale).filter(
        Sale.business_id == business_id,
        Sale.status == "COMPLETED",
        Sale.invoice_date >= start_date,
        Sale.invoice_date <= end_date
    ).all()

    total_revenue = sum(s.grand_total for s in sales)
    total_taxable = sum(s.taxable_amount for s in sales)
    total_gst_collected = sum(s.total_tax for s in sales)
    total_discounts = sum(s.discount_amount for s in sales)
    total_cogs = sum(s.total_cogs for s in sales)
    total_gross_profit = sum(s.gross_profit for s in sales)

    expenses = db.query(Expense).filter(
        Expense.business_id == business_id,
        Expense.expense_date >= start_date,
        Expense.expense_date <= end_date
    ).all()
    total_expenses = sum(e.amount for e in expenses)

    net_profit = round(total_gross_profit - total_expenses, 2)
    margin_percent = round((total_gross_profit / total_revenue * 100.0), 1) if total_revenue > 0 else 0.0

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_sales_count": len(sales),
        "total_revenue": round(total_revenue, 2),
        "taxable_turnover": round(total_taxable, 2),
        "gst_collected": round(total_gst_collected, 2),
        "total_discounts_given": round(total_discounts, 2),
        "cogs": round(total_cogs, 2),
        "gross_profit": round(total_gross_profit, 2),
        "gross_margin_percent": margin_percent,
        "total_expenses": round(total_expenses, 2),
        "net_profit": net_profit
    }
