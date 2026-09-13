import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models.auth import User
from app.models.party import Supplier, SupplierLedger
from app.models.finance import Account, AccountTransaction
from app.schemas.party import SupplierResponse, SupplierCreate, SupplierLedgerResponse, PaySupplierRequest
from app.auth import get_current_user

router = APIRouter(prefix="/suppliers", tags=["Suppliers & Distributor Khata"])

@router.get("", response_model=List[SupplierResponse])
def list_suppliers(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Supplier).filter(Supplier.business_id == current_user.business_id, Supplier.is_active == True)
    if search:
        s = f"%{search}%"
        query = query.filter(or_(Supplier.name.ilike(s), Supplier.company.ilike(s), Supplier.phone.ilike(s)))

    suppliers = query.order_by(Supplier.current_balance.desc()).all()
    return [SupplierResponse.model_validate(s) for s in suppliers]

@router.post("", response_model=SupplierResponse)
def create_supplier(
    req: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    supplier = Supplier(
        business_id=current_user.business_id,
        current_balance=req.opening_balance,
        **req.model_dump()
    )
    db.add(supplier)
    db.flush()

    if req.opening_balance != 0:
        ledger = SupplierLedger(
            business_id=current_user.business_id,
            supplier_id=supplier.id,
            entry_type="OPENING",
            debit=0.0,
            credit=req.opening_balance,
            balance=req.opening_balance,
            notes="Opening balance setup"
        )
        db.add(ledger)

    db.commit()
    db.refresh(supplier)
    return SupplierResponse.model_validate(supplier)

@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    supplier = db.query(Supplier).filter(
        Supplier.id == supplier_id,
        Supplier.business_id == current_user.business_id
    ).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return SupplierResponse.model_validate(supplier)

@router.get("/{supplier_id}/ledger", response_model=List[SupplierLedgerResponse])
def get_supplier_ledger(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    entries = db.query(SupplierLedger).filter(
        SupplierLedger.supplier_id == supplier_id,
        SupplierLedger.business_id == current_user.business_id
    ).order_by(SupplierLedger.id.desc()).all()
    return [SupplierLedgerResponse.model_validate(e) for e in entries]

@router.post("/{supplier_id}/pay")
def pay_supplier(
    supplier_id: int,
    req: PaySupplierRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    supplier = db.query(Supplier).filter(
        Supplier.id == supplier_id,
        Supplier.business_id == current_user.business_id
    ).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    amount = float(req.amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")

    supplier.total_paid += amount
    supplier.current_balance = max(0.0, supplier.current_balance - amount)

    # Supplier Ledger (Debit)
    ledger = SupplierLedger(
        business_id=current_user.business_id,
        supplier_id=supplier.id,
        entry_type="PAYMENT",
        debit=amount,
        credit=0.0,
        balance=supplier.current_balance,
        payment_method=req.payment_method.upper(),
        notes=req.notes or f"Paid via {req.payment_method.upper()}"
    )
    db.add(ledger)
    db.flush()

    # Deduct from bank or cash account
    acc_type = "CASH" if req.payment_method.upper() == "CASH" else "BANK"
    account = db.query(Account).filter(
        Account.business_id == current_user.business_id,
        Account.account_type == acc_type,
        Account.is_active == True
    ).first()
    if account:
        account.current_balance -= amount
        txn = AccountTransaction(
            business_id=current_user.business_id,
            account_id=account.id,
            txn_type="DEBIT",
            amount=amount,
            balance_after=account.current_balance,
            reference_type="SUPPLIER_PAYMENT",
            reference_id=ledger.id,
            payment_method=req.payment_method.upper(),
            notes=f"Payment made to {supplier.company or supplier.name}"
        )
        db.add(txn)

    db.commit()
    return {
        "success": True,
        "supplier_id": supplier.id,
        "amount_paid": amount,
        "remaining_payable": supplier.current_balance
    }
