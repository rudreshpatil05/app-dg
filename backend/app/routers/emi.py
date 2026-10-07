import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.auth import User
from app.models.emi import EmiPlan, EmiInstallment, EmiPayment
from app.models.party import Customer
from app.schemas.emi import EmiPlanResponse, CollectEmiRequest
from app.services.emi_service import collect_emi_payment, sync_emi_statuses, OPEN_INSTALLMENT_STATUSES
from app.services.whatsapp_service import generate_emi_reminder_whatsapp_link
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/emi", tags=["Store-Financed EMI Management"], dependencies=[Depends(require_role(["OWNER", "MANAGER", "STAFF", "ACCOUNTANT"]))])


def _plan_summary(plan: EmiPlan, today: datetime.date) -> dict:
    open_installments = [
        inst for inst in plan.installments
        if inst.status in OPEN_INSTALLMENT_STATUSES and inst.balance_due > 0
    ]
    next_installment = min(open_installments, key=lambda inst: inst.due_date) if open_installments else None
    return {
        "paid_installments": sum(1 for inst in plan.installments if inst.status == "PAID"),
        "remaining_installments": len(open_installments),
        "next_due_date": next_installment.due_date if next_installment else None,
        "next_due_amount": float(next_installment.balance_due) if next_installment else 0.0,
        "days_to_due": (next_installment.due_date - today).days if next_installment else None,
    }


def _plan_response(plan: EmiPlan, today: datetime.date) -> EmiPlanResponse:
    response = EmiPlanResponse.model_validate(plan)
    response.customer_name = plan.customer.name if plan.customer else "Walk-in"
    response.customer_phone = plan.customer.phone if plan.customer else ""
    for key, value in _plan_summary(plan, today).items():
        setattr(response, key, value)
    return response

@router.get("/dashboard")
def get_emi_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    biz_id = current_user.business_id
    today = datetime.date.today()
    sync_emi_statuses(db, biz_id, today)
    start_of_month = today.replace(day=1)
    plans = db.query(EmiPlan).filter(EmiPlan.business_id == biz_id).all()
    due_today = [
        (plan, installment)
        for plan in plans
        for installment in plan.installments
        if installment.due_date == today and installment.status in OPEN_INSTALLMENT_STATUSES and installment.balance_due > 0
    ]
    pending_plans = [plan for plan in plans if plan.status == "ACTIVE" and _plan_summary(plan, today)["remaining_installments"] > 0]
    upcoming = [
        (plan, installment)
        for plan in pending_plans
        for installment in plan.installments
        if installment.due_date > today and installment.status in OPEN_INSTALLMENT_STATUSES
    ]

    # 1. Total Active Plans & Outstanding EMI Receivable
    active_plans_count = db.query(EmiPlan).filter(EmiPlan.business_id == biz_id, EmiPlan.status == "ACTIVE").count()
    total_receivable = db.query(
        func.coalesce(func.sum(EmiPlan.balance_remaining), 0.0)
    ).filter(EmiPlan.business_id == biz_id, EmiPlan.status == "ACTIVE").scalar()

    # 2. Due Today
    due_today_val = db.query(
        func.coalesce(func.sum(EmiInstallment.balance_due), 0.0)
    ).filter(
        EmiInstallment.business_id == biz_id,
        EmiInstallment.due_date == today,
        EmiInstallment.status.in_(["PENDING", "OVERDUE", "PARTIAL"])
    ).scalar()

    # 3. Overdue Total
    overdue_val = db.query(
        func.coalesce(func.sum(EmiInstallment.balance_due), 0.0)
    ).filter(
        EmiInstallment.business_id == biz_id,
        EmiInstallment.status == "OVERDUE"
    ).scalar()

    # 4. Collected This Month
    collected_month = db.query(
        func.coalesce(func.sum(EmiPayment.amount), 0.0)
    ).filter(
        EmiPayment.business_id == biz_id,
        EmiPayment.payment_date >= start_of_month
    ).scalar()

    return {
        "active_plans_count": active_plans_count,
        "total_active_customers": len({plan.customer_id for plan in plans if plan.status == "ACTIVE"}),
        "total_emi_amount": float(sum(plan.total_repayable for plan in plans)),
        "total_collected": float(sum(plan.total_paid for plan in plans)),
        "total_remaining": float(sum(plan.balance_remaining for plan in plans)),
        "total_emi_receivable": float(total_receivable),
        "due_today": float(due_today_val),
        "due_today_count": len(due_today),
        "overdue_amount": float(overdue_val),
        "overdue_count": sum(1 for plan in plans for inst in plan.installments if inst.status == "OVERDUE" and inst.balance_due > 0),
        "upcoming_count": len(upcoming),
        "upcoming_amount": float(sum(inst.balance_due for _, inst in upcoming)),
        "collected_this_month": float(collected_month)
        ,"today": today.isoformat(),
        "due_today_items": [
            {
                "plan_id": plan.id,
                "installment_id": inst.id,
                "customer_name": plan.customer.name if plan.customer else "Walk-in",
                "customer_phone": plan.customer.phone if plan.customer else "",
                "product_name": plan.product_name,
                "installment_number": inst.installment_number,
                "amount": float(inst.balance_due),
                "due_date": inst.due_date.isoformat(),
                "status": inst.status,
            }
            for plan, inst in due_today
        ],
        "pending_plans": [
            {
                "id": plan.id,
                "customer_name": plan.customer.name if plan.customer else "Walk-in",
                "customer_phone": plan.customer.phone if plan.customer else "",
                "product_name": plan.product_name,
                "total_repayable": float(plan.total_repayable),
                "total_paid": float(plan.total_paid),
                "balance_remaining": float(plan.balance_remaining),
                "number_of_installments": plan.number_of_installments,
                "emi_amount": float(plan.emi_amount),
                **_plan_summary(plan, today),
            }
            for plan in pending_plans
        ]
    }

@router.get("/plans", response_model=List[EmiPlanResponse])
def list_emi_plans(
    status_filter: Optional[str] = None, # ACTIVE, COMPLETED, OVERDUE
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today = datetime.date.today()
    sync_emi_statuses(db, current_user.business_id, today)
    query = db.query(EmiPlan).filter(EmiPlan.business_id == current_user.business_id)
    if status_filter:
        query = query.filter(EmiPlan.status == status_filter.upper())

    plans = query.order_by(EmiPlan.id.desc()).all()
    return [_plan_response(plan, today) for plan in plans]

@router.get("/plans/{plan_id}", response_model=EmiPlanResponse)
def get_emi_plan_details(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    plan = db.query(EmiPlan).filter(
        EmiPlan.id == plan_id,
        EmiPlan.business_id == current_user.business_id
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="EMI Plan not found")

    sync_emi_statuses(db, current_user.business_id, datetime.date.today())
    return _plan_response(plan, datetime.date.today())

@router.post("/collect/{plan_id}")
def collect_plan_emi(
    plan_id: int,
    req: CollectEmiRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        plan = db.query(EmiPlan).filter(
            EmiPlan.id == plan_id,
            EmiPlan.business_id == current_user.business_id
        ).first()
        if not plan:
            raise HTTPException(status_code=404, detail="EMI Plan not found")

        res = collect_emi_payment(
            db=db,
            emi_plan_id=plan_id,
            installment_id=req.installment_id,
            amount=req.amount,
            payment_method=req.payment_method,
            reference_number=req.reference_number,
            user_id=current_user.id,
            payment_date=req.payment_date or datetime.date.today(),
            notes=req.notes
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/installments/{installment_id}/whatsapp-reminder")
def get_installment_whatsapp_link(
    installment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inst = db.query(EmiInstallment).filter(
        EmiInstallment.id == installment_id,
        EmiInstallment.business_id == current_user.business_id
    ).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Installment not found")

    plan = inst.emi_plan
    cust = plan.customer

    link = generate_emi_reminder_whatsapp_link(
        store_name=current_user.business.name,
        customer_name=cust.name if cust else "Customer",
        customer_phone=cust.phone if cust else "",
        product_name=plan.product_name,
        installment_no=inst.installment_number,
        due_date_str=inst.due_date.strftime("%d %b %Y"),
        emi_amount=inst.balance_due,
        upi_id=current_user.business.upi_id
    )

    return {
        "link": link,
        "phone": cust.phone if cust else "",
        "due_date": inst.due_date.isoformat(),
        "amount_due": inst.balance_due
    }
