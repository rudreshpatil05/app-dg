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
from app.services.emi_service import collect_emi_payment
from app.services.whatsapp_service import generate_emi_reminder_whatsapp_link
from app.auth import get_current_user

router = APIRouter(prefix="/emi", tags=["Store-Financed EMI Management"])

@router.get("/dashboard")
def get_emi_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    biz_id = current_user.business_id
    today = datetime.date.today()
    start_of_month = today.replace(day=1)

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
        "total_emi_receivable": float(total_receivable),
        "due_today": float(due_today_val),
        "overdue_amount": float(overdue_val),
        "collected_this_month": float(collected_month)
    }

@router.get("/plans", response_model=List[EmiPlanResponse])
def list_emi_plans(
    status_filter: Optional[str] = None, # ACTIVE, COMPLETED, OVERDUE
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(EmiPlan).filter(EmiPlan.business_id == current_user.business_id)
    if status_filter:
        query = query.filter(EmiPlan.status == status_filter.upper())

    plans = query.order_by(EmiPlan.id.desc()).all()
    results = []
    for p in plans:
        pr = EmiPlanResponse.model_validate(p)
        pr.customer_name = p.customer.name if p.customer else "Walk-in"
        pr.customer_phone = p.customer.phone if p.customer else ""
        results.append(pr)
    return results

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

    pr = EmiPlanResponse.model_validate(plan)
    pr.customer_name = plan.customer.name if plan.customer else ""
    pr.customer_phone = plan.customer.phone if plan.customer else ""
    return pr

@router.post("/collect/{plan_id}")
def collect_plan_emi(
    plan_id: int,
    req: CollectEmiRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
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
