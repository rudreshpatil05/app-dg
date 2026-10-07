import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models.auth import User
from app.models.party import Customer, CustomerLedger
from app.models.finance import Account, AccountTransaction
from app.schemas.party import CustomerResponse, CustomerCreate, CustomerLedgerResponse, ReceivePaymentRequest
from app.services.whatsapp_service import generate_customer_statement_whatsapp_link
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/customers", tags=["Customers & Khatabook Ledger"], dependencies=[Depends(require_role(["OWNER", "MANAGER", "STAFF", "ACCOUNTANT"]))])

@router.get("", response_model=List[CustomerResponse])
def list_customers(
    search: Optional[str] = None,
    balance_filter: Optional[str] = None, # "OWES_MONEY", "ALL"
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Customer).filter(Customer.business_id == current_user.business_id, Customer.is_active == True)

    if search:
        s = f"%{search}%"
        query = query.filter(or_(Customer.name.ilike(s), Customer.phone.ilike(s), Customer.city.ilike(s)))

    if balance_filter == "OWES_MONEY":
        query = query.filter(Customer.current_balance > 0)

    customers = query.order_by(Customer.current_balance.desc(), Customer.name.asc()).all()
    return [CustomerResponse.model_validate(c) for c in customers]

@router.post("", response_model=CustomerResponse)
def create_customer(
    cust: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(Customer).filter(
        Customer.business_id == current_user.business_id,
        Customer.phone == cust.phone.strip()
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Customer with this mobile number already exists")

    c_obj = Customer(
        business_id=current_user.business_id,
        current_balance=cust.opening_balance,
        **cust.model_dump()
    )
    db.add(c_obj)
    db.flush()

    if cust.opening_balance != 0:
        ledger = CustomerLedger(
            business_id=current_user.business_id,
            customer_id=c_obj.id,
            entry_type="OPENING",
            debit=cust.opening_balance if cust.opening_balance > 0 else 0.0,
            credit=abs(cust.opening_balance) if cust.opening_balance < 0 else 0.0,
            balance=cust.opening_balance,
            notes="Opening balance setup"
        )
        db.add(ledger)

    db.commit()
    db.refresh(c_obj)
    return CustomerResponse.model_validate(c_obj)

@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer_details(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cust = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.business_id == current_user.business_id
    ).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerResponse.model_validate(cust)

@router.get("/{customer_id}/ledger", response_model=List[CustomerLedgerResponse])
def get_customer_ledger(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    entries = db.query(CustomerLedger).filter(
        CustomerLedger.customer_id == customer_id,
        CustomerLedger.business_id == current_user.business_id
    ).order_by(CustomerLedger.id.desc()).all()
    return [CustomerLedgerResponse.model_validate(e) for e in entries]

@router.post("/{customer_id}/receive-payment")
def receive_customer_payment(
    customer_id: int,
    req: ReceivePaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Khatabook-style "Receive Payment" entry that updates customer khata and cash/bank account.
    """
    cust = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.business_id == current_user.business_id
    ).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    amount = float(req.amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")

    cust.total_paid += amount
    cust.current_balance = max(0.0, cust.current_balance - amount)

    # Customer Ledger Entry (You Got / Credit)
    ledger = CustomerLedger(
        business_id=current_user.business_id,
        customer_id=cust.id,
        entry_type="PAYMENT",
        debit=0.0,
        credit=amount,
        balance=cust.current_balance,
        payment_method=req.payment_method.upper(),
        reference_type="payment",
        notes=req.notes or f"Payment received via {req.payment_method.upper()}"
    )
    db.add(ledger)
    db.flush()

    # Update Financial Account
    acc_type = "CASH" if req.payment_method.upper() == "CASH" else "BANK"
    account = db.query(Account).filter(
        Account.business_id == current_user.business_id,
        Account.account_type == acc_type,
        Account.is_active == True
    ).first()

    if account:
        account.current_balance += amount
        txn = AccountTransaction(
            business_id=current_user.business_id,
            account_id=account.id,
            txn_type="CREDIT",
            amount=amount,
            balance_after=account.current_balance,
            reference_type="CUSTOMER_PAYMENT",
            reference_id=ledger.id,
            payment_method=req.payment_method.upper(),
            notes=f"Khata payment received from {cust.name}"
        )
        db.add(txn)

    db.commit()

    return {
        "success": True,
        "customer_id": cust.id,
        "amount_received": amount,
        "new_balance": cust.current_balance
    }

@router.get("/{customer_id}/whatsapp-reminder")
def get_whatsapp_reminder(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cust = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.business_id == current_user.business_id
    ).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    link = generate_customer_statement_whatsapp_link(
        store_name=current_user.business.name,
        customer_name=cust.name,
        customer_phone=cust.phone,
        total_balance=cust.current_balance,
        upi_id=current_user.business.upi_id
    )

    return {"link": link, "phone": cust.phone, "balance": cust.current_balance}
