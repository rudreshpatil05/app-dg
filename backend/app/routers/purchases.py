import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User
from app.models.purchase import Purchase, PurchaseItem
from app.models.product import Product, SerialNumber, StockMovement
from app.models.party import Supplier, SupplierLedger
from app.models.finance import Account, AccountTransaction
from app.schemas.purchase import PurchaseCreateRequest, PurchaseResponse, PurchaseItemResponse
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/purchases", tags=["Purchases & Inward Stock"], dependencies=[Depends(require_role(["OWNER", "MANAGER"]))])

@router.get("", response_model=List[PurchaseResponse])
def list_purchases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    purchases = db.query(Purchase).filter(
        Purchase.business_id == current_user.business_id
    ).order_by(Purchase.id.desc()).all()

    results = []
    for p in purchases:
        pr = PurchaseResponse.model_validate(p)
        pr.supplier_name = p.supplier.company or p.supplier.name if p.supplier else "Supplier"
        item_responses = []
        for it in p.items:
            ir = PurchaseItemResponse.model_validate(it)
            ir.product_name = it.product.name if it.product else ""
            item_responses.append(ir)
        pr.items = item_responses
        results.append(pr)
    return results

@router.post("", response_model=PurchaseResponse)
def create_purchase(
    req: PurchaseCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    biz_id = current_user.business_id

    supplier = db.query(Supplier).filter(Supplier.id == req.supplier_id, Supplier.business_id == biz_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    subtotal = 0.0
    gst_total = 0.0

    prepared_items = []
    for it in req.items:
        prod = db.query(Product).filter(Product.id == it.product_id, Product.business_id == biz_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Product {it.product_id} not found")

        qty = len(it.imeis) if (prod.is_serialized and it.imeis) else it.quantity
        line_total = (it.unit_cost * qty)
        line_gst = round((line_total * (it.gst_rate / 100.0)), 2)
        
        subtotal += line_total
        gst_total += line_gst

        prepared_items.append({
            "product": prod,
            "product_id": prod.id,
            "variant_id": it.variant_id,
            "quantity": qty,
            "unit_cost": it.unit_cost,
            "gst_rate": it.gst_rate,
            "gst_amount": line_gst,
            "total": line_total + line_gst,
            "imeis": it.imeis or []
        })

    grand_total = max(0.0, (subtotal + gst_total) - req.discount)
    if req.discount > subtotal + gst_total:
        raise HTTPException(status_code=400, detail="Discount cannot exceed purchase total")
    if req.paid_amount > grand_total + 0.01:
        raise HTTPException(status_code=400, detail="Paid amount cannot exceed purchase total")
    balance_due = max(0.0, grand_total - req.paid_amount)
    pmt_status = "PAID" if balance_due <= 0.01 else ("PARTIAL" if req.paid_amount > 0 else "UNPAID")

    purchase = Purchase(
        business_id=biz_id,
        supplier_id=supplier.id,
        invoice_number=req.invoice_number,
        invoice_date=req.invoice_date,
        subtotal=subtotal,
        discount=req.discount,
        gst_amount=gst_total,
        total_amount=grand_total,
        paid_amount=req.paid_amount,
        balance_due=balance_due,
        payment_status=pmt_status,
        payment_method=req.payment_method,
        notes=req.notes
    )
    db.add(purchase)
    db.flush()

    # Process items and register IMEIs
    for p_it in prepared_items:
        p_item = PurchaseItem(
            business_id=biz_id,
            purchase_id=purchase.id,
            product_id=p_it["product_id"],
            variant_id=p_it["variant_id"],
            quantity=p_it["quantity"],
            unit_cost=p_it["unit_cost"],
            gst_rate=p_it["gst_rate"],
            gst_amount=p_it["gst_amount"],
            total=p_it["total"],
            imei_records=p_it["imeis"]
        )
        db.add(p_item)

        prod = p_it["product"]
        prev_stk = prod.current_stock
        prod.current_stock += p_it["quantity"]
        # Update product purchase cost to latest purchase price
        prod.purchase_cost = p_it["unit_cost"]

        # Register Serial Numbers (IMEIs)
        if prod.is_serialized and p_it["imeis"]:
            for imei_str in p_it["imeis"]:
                imei_clean = imei_str.strip()
                if not imei_clean:
                    continue
                # Ensure uniqueness
                exist = db.query(SerialNumber).filter(
                    SerialNumber.business_id == biz_id,
                    SerialNumber.imei1 == imei_clean
                ).first()
                if exist:
                    raise HTTPException(status_code=400, detail=f"IMEI {imei_clean} already registered in system!")

                s_obj = SerialNumber(
                    business_id=biz_id,
                    product_id=prod.id,
                    variant_id=p_it["variant_id"],
                    imei1=imei_clean,
                    purchase_cost=p_it["unit_cost"],
                    selling_price=prod.selling_price,
                    status="IN_STOCK",
                    purchase_id=purchase.id,
                    supplier_id=supplier.id,
                    notes=f"Purchased on Bill #{purchase.invoice_number}"
                )
                db.add(s_obj)

        # Stock Movement
        mov = StockMovement(
            business_id=biz_id,
            product_id=prod.id,
            movement_type="PURCHASE",
            quantity=p_it["quantity"],
            previous_stock=prev_stk,
            current_stock=prod.current_stock,
            reference_id=purchase.id,
            reference_type="purchase",
            notes=f"Purchase from {supplier.company or supplier.name}"
        )
        db.add(mov)

    # Update Supplier Ledger (You Owe Supplier / Credit)
    supplier.total_purchases += grand_total
    supplier.total_paid += req.paid_amount
    supplier.current_balance += balance_due

    s_ledger = SupplierLedger(
        business_id=biz_id,
        supplier_id=supplier.id,
        entry_type="PURCHASE",
        debit=req.paid_amount,
        credit=grand_total,
        balance=supplier.current_balance,
        payment_method=req.payment_method,
        reference_id=purchase.id,
        reference_type="purchase",
        notes=f"Purchase Bill #{purchase.invoice_number}"
    )
    db.add(s_ledger)

    # If payment was made from cash/bank, debit account
    if req.paid_amount > 0:
        acc_type = "CASH" if req.payment_method.upper() == "CASH" else "BANK"
        account = db.query(Account).filter(
            Account.business_id == biz_id,
            Account.account_type == acc_type,
            Account.is_active == True
        ).first()
        if account:
            account.current_balance -= req.paid_amount
            txn = AccountTransaction(
                business_id=biz_id,
                account_id=account.id,
                txn_type="DEBIT",
                amount=req.paid_amount,
                balance_after=account.current_balance,
                reference_type="PURCHASE",
                reference_id=purchase.id,
                payment_method=req.payment_method,
                notes=f"Payment for purchase #{purchase.invoice_number}"
            )
            db.add(txn)

    db.commit()
    db.refresh(purchase)
    
    pr = PurchaseResponse.model_validate(purchase)
    pr.supplier_name = supplier.company or supplier.name
    return pr
