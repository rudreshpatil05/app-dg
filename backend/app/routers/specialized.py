import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models.auth import User
from app.models.specialized import ExchangeDevice, WarrantyRecord, RepairTicket, RepairPayment
from app.models.finance import Account, AccountTransaction
from app.schemas.specialized import (
    ExchangeDeviceResponse, WarrantyResponse, RepairTicketCreate, RepairTicketResponse
)
from app.auth import get_current_user

router = APIRouter(prefix="/specialized", tags=["Mobile Exchange, Warranty & Repairs"])

# ----------------- 1. Exchange / Old Mobile Buyback -----------------
@router.get("/exchange", response_model=List[ExchangeDeviceResponse])
def list_exchange_devices(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ExchangeDevice).filter(ExchangeDevice.business_id == current_user.business_id)
    if status_filter:
        query = query.filter(ExchangeDevice.status == status_filter.upper())
    devices = query.order_by(ExchangeDevice.id.desc()).all()
    return [ExchangeDeviceResponse.model_validate(d) for d in devices]

@router.post("/exchange/{device_id}/status")
def update_exchange_status(
    device_id: int,
    status_update: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dev = db.query(ExchangeDevice).filter(
        ExchangeDevice.id == device_id,
        ExchangeDevice.business_id == current_user.business_id
    ).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Exchange device not found")

    new_st = status_update.get("status", "").upper()
    if new_st in ["RECEIVED", "INSPECTION_PENDING", "ACCEPTED", "REFURBISHMENT", "RESALE", "SCRAP"]:
        dev.status = new_st
    if status_update.get("resale_price"):
        dev.resale_price = float(status_update["resale_price"])
    if status_update.get("notes"):
        dev.notes = status_update["notes"]

    db.commit()
    return {"success": True, "device_id": dev.id, "status": dev.status}

# ----------------- 2. Warranty Tracking -----------------
@router.get("/warranty", response_model=List[WarrantyResponse])
def list_warranties(
    search: Optional[str] = None,
    status_filter: Optional[str] = None, # ACTIVE, EXPIRED, CLAIMED
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(WarrantyRecord).filter(WarrantyRecord.business_id == current_user.business_id)
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                WarrantyRecord.imei.ilike(s),
                WarrantyRecord.customer_phone.ilike(s),
                WarrantyRecord.customer_name.ilike(s),
                WarrantyRecord.product_name.ilike(s)
            )
        )
    if status_filter:
        query = query.filter(WarrantyRecord.status == status_filter.upper())

    records = query.order_by(WarrantyRecord.id.desc()).limit(100).all()
    
    # Auto-flag expired
    today = datetime.date.today()
    for r in records:
        if r.status == "ACTIVE" and r.warranty_end < today:
            r.status = "EXPIRED"

    return [WarrantyResponse.model_validate(r) for r in records]

# ----------------- 3. Repairs & Service Center -----------------
@router.get("/repairs", response_model=List[RepairTicketResponse])
def list_repairs(
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(RepairTicket).filter(RepairTicket.business_id == current_user.business_id)
    if status_filter:
        query = query.filter(RepairTicket.status == status_filter.upper())
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                RepairTicket.ticket_number.ilike(s),
                RepairTicket.customer_name.ilike(s),
                RepairTicket.customer_phone.ilike(s),
                RepairTicket.imei_or_serial.ilike(s),
                RepairTicket.device_name.ilike(s)
            )
        )

    tickets = query.order_by(RepairTicket.id.desc()).all()
    return [RepairTicketResponse.model_validate(t) for t in tickets]

@router.post("/repairs", response_model=RepairTicketResponse)
def create_repair_ticket(
    req: RepairTicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    biz_id = current_user.business_id
    today = datetime.date.today()
    
    # Generate sequential ticket number: REP-YYYY-XXXX
    count_today = db.query(RepairTicket).filter(
        RepairTicket.business_id == biz_id,
        RepairTicket.ticket_number.like(f"REP-{today.year}-%")
    ).count()
    ticket_num = f"REP-{today.year}-{count_today + 1:04d}"

    ticket = RepairTicket(
        business_id=biz_id,
        ticket_number=ticket_num,
        customer_name=req.customer_name,
        customer_phone=req.customer_phone,
        device_name=req.device_name,
        imei_or_serial=req.imei_or_serial,
        device_passcode=req.device_passcode,
        problem_description=req.problem_description,
        accessories_received=req.accessories_received,
        estimated_cost=req.estimated_cost,
        final_cost=req.estimated_cost,
        advance_paid=req.advance_paid,
        technician_name=req.technician_name,
        status="RECEIVED",
        received_date=today,
        expected_completion=req.expected_completion or (today + datetime.timedelta(days=2)),
        notes=req.notes
    )
    db.add(ticket)
    db.flush()

    # Record advance payment if collected
    if req.advance_paid > 0:
        acc_type = "CASH" if req.payment_method.upper() == "CASH" else "BANK"
        account = db.query(Account).filter(
            Account.business_id == biz_id,
            Account.account_type == acc_type,
            Account.is_active == True
        ).first()

        pmt = RepairPayment(
            business_id=biz_id,
            repair_ticket_id=ticket.id,
            amount=req.advance_paid,
            payment_method=req.payment_method.upper(),
            account_id=account.id if account else None,
            payment_date=today,
            notes=f"Advance for repair ticket {ticket.ticket_number}"
        )
        db.add(pmt)

        if account:
            account.current_balance += req.advance_paid
            txn = AccountTransaction(
                business_id=biz_id,
                account_id=account.id,
                txn_type="CREDIT",
                amount=req.advance_paid,
                balance_after=account.current_balance,
                reference_type="REPAIR_ADVANCE",
                reference_id=ticket.id,
                payment_method=req.payment_method.upper(),
                notes=f"Repair advance for {ticket.device_name}"
            )
            db.add(txn)

    db.commit()
    db.refresh(ticket)
    return RepairTicketResponse.model_validate(ticket)

@router.put("/repairs/{ticket_id}/status")
def update_repair_status(
    ticket_id: int,
    update_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(RepairTicket).filter(
        RepairTicket.id == ticket_id,
        RepairTicket.business_id == current_user.business_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Repair ticket not found")

    new_st = update_data.get("status", "").upper()
    valid_statuses = ["RECEIVED", "DIAGNOSING", "REPAIRING", "READY", "DELIVERED", "CANCELLED"]
    if new_st in valid_statuses:
        ticket.status = new_st
        if new_st == "READY":
            ticket.completed_date = datetime.date.today()
        elif new_st == "DELIVERED":
            ticket.delivery_date = datetime.date.today()

    if "final_cost" in update_data:
        ticket.final_cost = float(update_data["final_cost"])
    if "technician_name" in update_data:
        ticket.technician_name = update_data["technician_name"]
    if "notes" in update_data:
        ticket.notes = update_data["notes"]

    db.commit()
    return {"success": True, "ticket_id": ticket.id, "status": ticket.status}
