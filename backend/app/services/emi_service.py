import datetime
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from app.models.emi import EmiPlan, EmiInstallment, EmiPayment
from app.models.party import Customer, CustomerLedger
from app.models.finance import Account, AccountTransaction

OPEN_INSTALLMENT_STATUSES = {"PENDING", "DUE_TODAY", "OVERDUE", "PARTIAL"}


def sync_emi_statuses(db: Session, business_id: int, today: datetime.date | None = None) -> bool:
    """Synchronize open installment labels with the current date."""
    current_date = today or datetime.date.today()
    changed = False
    plans = db.query(EmiPlan).filter(EmiPlan.business_id == business_id).all()

    for plan in plans:
        for installment in plan.installments:
            if installment.status == "PAID" or installment.balance_due <= 0:
                if installment.status != "PAID":
                    installment.status = "PAID"
                    installment.balance_due = 0.0
                    changed = True
                continue

            next_status = "OVERDUE" if installment.due_date < current_date else (
                "DUE_TODAY" if installment.due_date == current_date else "PARTIAL" if installment.paid_amount > 0 else "PENDING"
            )
            if installment.status != next_status:
                installment.status = next_status
                changed = True

        if plan.balance_remaining <= 0 and plan.status != "COMPLETED":
            plan.status = "COMPLETED"
            changed = True
        elif plan.balance_remaining > 0 and plan.status == "COMPLETED":
            plan.status = "ACTIVE"
            changed = True

    if changed:
        db.commit()
    return changed

def calculate_emi_plan_details(
    financed_principal: float,
    annual_interest_rate: float,
    months: int,
    processing_fee: float = 0.0
) -> dict:
    """
    Calculates EMI details for Indian retail store financing.
    Supports 0% interest schemes (very common in Indian mobile retail) or flat/reducing rate.
    """
    if financed_principal < 0:
        raise ValueError("Financed amount cannot be negative")
    if annual_interest_rate < 0:
        raise ValueError("Interest rate cannot be negative")
    if processing_fee < 0:
        raise ValueError("Processing fee cannot be negative")
    if months <= 0:
        raise ValueError("EMI duration must be greater than zero")

    if annual_interest_rate == 0:
        total_interest = 0.0
        total_repayable = financed_principal + processing_fee
        base_emi = round(total_repayable / months, 2)
    else:
        # Simple interest calculation common for store-financing
        total_interest = round((financed_principal * annual_interest_rate * (months / 12.0)) / 100.0, 2)
        total_repayable = financed_principal + total_interest + processing_fee
        base_emi = round(total_repayable / months, 2)

    return {
        "financed_principal": financed_principal,
        "interest_rate": annual_interest_rate,
        "interest_amount": total_interest,
        "processing_fee": processing_fee,
        "total_repayable": total_repayable,
        "base_emi": base_emi,
        "number_of_installments": months
    }

def create_emi_installments(
    db: Session,
    emi_plan: EmiPlan,
    start_due_date: datetime.date
):
    """
    Generates exact installment schedule with rupee reconciliation on the last installment.
    """
    months = emi_plan.number_of_installments
    total_repayable = emi_plan.total_repayable
    
    monthly_emi = round(total_repayable / months, 2)
    accumulated_emi = 0.0
    
    installments = []
    for i in range(1, months + 1):
        due_date = start_due_date + relativedelta(months=i)
        
        if i == months:
            # Reconcile rounding discrepancy on last installment
            current_installment_amount = round(total_repayable - accumulated_emi, 2)
        else:
            current_installment_amount = monthly_emi
            accumulated_emi += current_installment_amount

        inst = EmiInstallment(
            business_id=emi_plan.business_id,
            emi_plan_id=emi_plan.id,
            installment_number=i,
            due_date=due_date,
            emi_amount=current_installment_amount,
            paid_amount=0.0,
            balance_due=current_installment_amount,
            status="PENDING"
        )
        db.add(inst)
        installments.append(inst)
    
    db.flush()
    return installments

def collect_emi_payment(
    db: Session,
    emi_plan_id: int,
    installment_id: int | None,
    amount: float,
    payment_method: str,
    reference_number: str | None,
    user_id: int,
    payment_date: datetime.date,
    notes: str | None = None
) -> dict:
    """
    Records an EMI collection, updates installment status, updates customer ledger, and updates cash/bank account.
    """
    plan = db.query(EmiPlan).filter(EmiPlan.id == emi_plan_id).first()
    if not plan:
        raise ValueError("EMI Plan not found")

    customer = db.query(Customer).filter(Customer.id == plan.customer_id).first()
    if amount <= 0:
        raise ValueError("Payment amount must be greater than zero")

    sync_emi_statuses(db, plan.business_id, payment_date)
    
    # Target specific installment or oldest pending installment
    target_installment = None
    if installment_id:
        target_installment = db.query(EmiInstallment).filter(
            EmiInstallment.id == installment_id,
            EmiInstallment.emi_plan_id == emi_plan_id
        ).first()
    
    if not target_installment:
        target_installment = db.query(EmiInstallment).filter(
            EmiInstallment.emi_plan_id == emi_plan_id,
            EmiInstallment.status.in_(OPEN_INSTALLMENT_STATUSES)
        ).order_by(EmiInstallment.installment_number.asc()).first()

    if not target_installment:
        raise ValueError("No pending EMI installment found")
    if target_installment.status == "PAID" or target_installment.balance_due <= 0:
        raise ValueError("This EMI installment is already paid")
    if amount > target_installment.balance_due + 0.01:
        raise ValueError("Payment cannot exceed the installment balance")

    # Create Payment record
    payment = EmiPayment(
        business_id=plan.business_id,
        emi_plan_id=plan.id,
        installment_id=target_installment.id if target_installment else None,
        customer_id=plan.customer_id,
        payment_date=payment_date,
        amount=amount,
        payment_method=payment_method.upper(),
        reference_number=reference_number,
        collected_by_user_id=user_id,
        notes=notes
    )
    db.add(payment)

    # Update installment status
    target_installment.paid_amount += amount
    target_installment.balance_due = max(0.0, target_installment.emi_amount - target_installment.paid_amount)
    if target_installment.balance_due <= 0.01:
        target_installment.balance_due = 0.0
        target_installment.status = "PAID"
        target_installment.paid_date = payment_date
    else:
        target_installment.status = "PARTIAL"

    # Update plan totals
    plan.total_paid += amount
    plan.balance_remaining = max(0.0, plan.total_repayable - plan.total_paid)
    if plan.balance_remaining == 0:
        plan.status = "COMPLETED"

    # Update Customer Khata balance
    if customer:
        customer.total_paid += amount
        customer.current_balance = max(0.0, customer.current_balance - amount)
        
        # Add to Customer Ledger (You Got)
        ledger_entry = CustomerLedger(
            business_id=plan.business_id,
            customer_id=customer.id,
            entry_type="EMI_PAYMENT",
            debit=0.0,
            credit=amount,
            balance=customer.current_balance,
            payment_method=payment_method.upper(),
            reference_id=payment.id,
            reference_type="emi_payment",
            notes=f"EMI Payment for {plan.product_name} (Inst #{target_installment.installment_number if target_installment else 'General'})"
        )
        db.add(ledger_entry)

    # Update Cash or Bank Account
    account_type = "CASH" if payment_method.upper() == "CASH" else "BANK"
    account = db.query(Account).filter(
        Account.business_id == plan.business_id,
        Account.account_type == account_type,
        Account.is_active == True
    ).first()
    
    if account:
        account.current_balance += amount
        payment.account_id = account.id
        txn = AccountTransaction(
            business_id=plan.business_id,
            account_id=account.id,
            txn_type="CREDIT",
            amount=amount,
            balance_after=account.current_balance,
            reference_type="EMI",
            reference_id=payment.id,
            payment_method=payment_method.upper(),
            notes=f"EMI collected from {customer.name if customer else 'Customer'}"
        )
        db.add(txn)

    db.commit()
    return {
        "success": True,
        "payment_id": payment.id,
        "amount": amount,
        "remaining_balance": plan.balance_remaining,
        "plan_status": plan.status
    }
