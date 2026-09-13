import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User
from app.models.finance import Expense, ExpenseCategory, Account, AccountTransaction, CashReconciliation
from app.schemas.finance import (
    ExpenseResponse, ExpenseCreate, ExpenseCategoryResponse,
    AccountResponse, CashReconciliationRequest, CashReconciliationResponse
)
from app.services.accounting_service import (
    get_daily_cash_reconciliation_summary, record_cash_reconciliation
)
from app.auth import get_current_user

router = APIRouter(prefix="/finance", tags=["Expenses, Cash & Bank Reconciliation"])

@router.get("/expense-categories", response_model=List[ExpenseCategoryResponse])
def list_expense_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ExpenseCategory).filter(
        ExpenseCategory.business_id == current_user.business_id,
        ExpenseCategory.is_active == True
    ).all()

@router.get("/expenses", response_model=List[ExpenseResponse])
def list_expenses(
    category_id: Optional[int] = None,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Expense).filter(Expense.business_id == current_user.business_id)
    if category_id:
        query = query.filter(Expense.category_id == category_id)
    if start_date:
        query = query.filter(Expense.expense_date >= start_date)
    if end_date:
        query = query.filter(Expense.expense_date <= end_date)

    expenses = query.order_by(Expense.expense_date.desc(), Expense.id.desc()).all()
    results = []
    for e in expenses:
        er = ExpenseResponse.model_validate(e)
        er.category_name = e.category.name if e.category else ""
        results.append(er)
    return results

@router.post("/expenses", response_model=ExpenseResponse)
def create_expense(
    req: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    biz_id = current_user.business_id
    cat = db.query(ExpenseCategory).filter(ExpenseCategory.id == req.category_id, ExpenseCategory.business_id == biz_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Expense category not found")

    # Deduct from cash or bank account
    acc_type = "CASH" if req.payment_method.upper() == "CASH" else "BANK"
    account = db.query(Account).filter(
        Account.business_id == biz_id,
        Account.account_type == acc_type,
        Account.is_active == True
    ).first()

    exp = Expense(
        business_id=biz_id,
        account_id=account.id if account else None,
        **req.model_dump()
    )
    db.add(exp)
    db.flush()

    if account:
        account.current_balance -= req.amount
        txn = AccountTransaction(
            business_id=biz_id,
            account_id=account.id,
            txn_type="DEBIT",
            amount=req.amount,
            balance_after=account.current_balance,
            reference_type="EXPENSE",
            reference_id=exp.id,
            payment_method=req.payment_method.upper(),
            notes=f"Expense: {cat.name} ({req.vendor or ''})"
        )
        db.add(txn)

    db.commit()
    db.refresh(exp)
    
    er = ExpenseResponse.model_validate(exp)
    er.category_name = cat.name
    return er

@router.get("/accounts", response_model=List[AccountResponse])
def list_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    accounts = db.query(Account).filter(
        Account.business_id == current_user.business_id,
        Account.is_active == True
    ).all()
    return [AccountResponse.model_validate(a) for a in accounts]

@router.get("/cash-reconciliation/summary")
def get_reconciliation_summary(
    target_date: Optional[datetime.date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    d = target_date or datetime.date.today()
    return get_daily_cash_reconciliation_summary(db, current_user.business_id, d)

@router.post("/cash-reconciliation", response_model=CashReconciliationResponse)
def submit_cash_reconciliation(
    req: CashReconciliationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    recon = record_cash_reconciliation(
        db=db,
        business_id=current_user.business_id,
        user_id=current_user.id,
        target_date=req.target_date,
        actual_physical_cash=req.actual_physical_cash,
        notes=req.notes
    )
    return CashReconciliationResponse.model_validate(recon)

@router.get("/cash-reconciliations", response_model=List[CashReconciliationResponse])
def list_reconciliations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    recons = db.query(CashReconciliation).filter(
        CashReconciliation.business_id == current_user.business_id
    ).order_by(CashReconciliation.reconciliation_date.desc()).limit(30).all()
    return [CashReconciliationResponse.model_validate(r) for r in recons]
