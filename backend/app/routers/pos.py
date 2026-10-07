import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models.auth import User
from app.models.sale import Sale, SaleItem, SalePayment, SaleReturn, SaleReturnItem
from app.models.product import SerialNumber
from app.schemas.pos import PosSaleRequest, SaleResponse, SaleItemResponse
from app.services.pos_service import process_pos_sale
from app.services.whatsapp_service import generate_invoice_whatsapp_link
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/pos", tags=["Sales & POS Billing"], dependencies=[Depends(require_role(["OWNER", "MANAGER", "STAFF"]))])

@router.post("/checkout", response_model=SaleResponse)
def pos_checkout(
    req: PosSaleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        sale = process_pos_sale(
            db=db,
            business_id=current_user.business_id,
            user_id=current_user.id,
            user_name=current_user.full_name,
            user_role=current_user.role.code if current_user.role else "STAFF",
            customer_data=req.customer,
            items_data=[item.model_dump() for item in req.items],
            discount_amount=req.discount_amount,
            is_gst_invoice=req.is_gst_invoice,
            exchange_device_data=req.exchange_device.model_dump() if req.exchange_device else None,
            payments_data=[p.model_dump() for p in req.payments],
            emi_details=req.emi_details.model_dump() if req.emi_details else None,
            notes=req.notes
        )

        # Generate WhatsApp link for instant counter sharing
        items_summary = ", ".join([f"{it.product_name} (x{it.quantity})" for it in sale.items])
        wa_link = generate_invoice_whatsapp_link(
            store_name=current_user.business.name,
            customer_name=sale.customer_name,
            customer_phone=sale.customer_phone,
            invoice_number=sale.invoice_number,
            final_amount=sale.final_payable,
            paid_amount=sale.paid_amount,
            balance_due=sale.balance_due,
            items_summary=items_summary
        )

        resp = SaleResponse.model_validate(sale)
        resp.whatsapp_link = wa_link
        if sale.emi_plan:
            resp.emi_amount = sale.emi_plan.emi_amount
            resp.emi_duration = sale.emi_plan.number_of_installments
            resp.emi_down_payment = sale.emi_plan.down_payment
            resp.emi_total_repayable = sale.emi_plan.total_repayable
        
        # Mask profit if STAFF
        if current_user.role and current_user.role.code == "STAFF":
            resp.gross_profit = None

        return resp
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to process sale: {str(e)}")

@router.get("/sales", response_model=List[SaleResponse])
def list_sales(
    search: Optional[str] = None,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    payment_status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Sale).filter(Sale.business_id == current_user.business_id)

    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                Sale.invoice_number.ilike(s),
                Sale.customer_name.ilike(s),
                Sale.customer_phone.ilike(s)
            )
        )
    if start_date:
        query = query.filter(Sale.invoice_date >= start_date)
    if end_date:
        query = query.filter(Sale.invoice_date <= end_date)
    if payment_status:
        query = query.filter(Sale.payment_status == payment_status.upper())

    sales = query.order_by(Sale.id.desc()).limit(limit).all()
    is_staff = (current_user.role.code == "STAFF") if current_user.role else False

    results = []
    for s in sales:
        sr = SaleResponse.model_validate(s)
        if is_staff:
            sr.gross_profit = None
        results.append(sr)
    return results

@router.get("/sales/{sale_id}", response_model=SaleResponse)
def get_sale_details(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sale = db.query(Sale).filter(
        Sale.id == sale_id,
        Sale.business_id == current_user.business_id
    ).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale invoice not found")

    items_summary = ", ".join([f"{it.product_name} (x{it.quantity})" for it in sale.items])
    wa_link = generate_invoice_whatsapp_link(
        store_name=current_user.business.name,
        customer_name=sale.customer_name,
        customer_phone=sale.customer_phone,
        invoice_number=sale.invoice_number,
        final_amount=sale.final_payable,
        paid_amount=sale.paid_amount,
        balance_due=sale.balance_due,
        items_summary=items_summary
    )

    resp = SaleResponse.model_validate(sale)
    resp.whatsapp_link = wa_link
    if current_user.role and current_user.role.code == "STAFF":
        resp.gross_profit = None
    return resp

@router.post("/sales/{sale_id}/return")
def process_sale_return(
    sale_id: int,
    return_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sale = db.query(Sale).filter(
        Sale.id == sale_id,
        Sale.business_id == current_user.business_id
    ).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale invoice not found")

    items_to_return = return_data.get("items", []) # [{"sale_item_id": ..., "quantity": 1, "refund_price": ...}]
    reason = return_data.get("reason", "CUSTOMER_RETURN")
    refund_amount = float(return_data.get("refund_amount", 0.0))

    ret_number = f"RET-{datetime.date.today().strftime('%Y%m%d')}-{sale.id:04d}"
    sale_ret = SaleReturn(
        business_id=current_user.business_id,
        sale_id=sale.id,
        customer_id=sale.customer_id,
        return_number=ret_number,
        return_date=datetime.date.today(),
        refund_amount=refund_amount,
        refund_method=return_data.get("refund_method", "CASH"),
        reason=reason,
        notes=return_data.get("notes")
    )
    db.add(sale_ret)
    db.flush()

    for r_item in items_to_return:
        sale_item_id = r_item.get("sale_item_id")
        s_item = db.query(SaleItem).filter(
            SaleItem.id == sale_item_id,
            SaleItem.sale_id == sale.id,
            SaleItem.business_id == current_user.business_id
        ).first()
        if not s_item:
            raise HTTPException(status_code=400, detail="Sale item does not belong to this sale")

        ret_item = SaleReturnItem(
            business_id=current_user.business_id,
            sale_return_id=sale_ret.id,
            sale_item_id=s_item.id,
            product_id=s_item.product_id,
            serial_number_id=s_item.serial_number_id,
            quantity=r_item.get("quantity", 1),
            refund_price=r_item.get("refund_price", s_item.unit_price),
            inspection_status="PENDING_INSPECTION",
            notes=r_item.get("notes", "Customer return pending inspection")
        )
        db.add(ret_item)

        # Mark Serial status as RETURNED (not immediately sellable).
        if s_item.serial_number_id:
            s_num = db.query(SerialNumber).filter(
                SerialNumber.id == s_item.serial_number_id,
                SerialNumber.business_id == current_user.business_id
            ).first()
            if s_num:
                s_num.status = "RETURNED"

    db.commit()
    return {"success": True, "return_number": ret_number, "status": "RETURNED_PENDING_INSPECTION"}
