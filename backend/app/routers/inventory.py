from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models.auth import User
from app.models.product import Category, Product, ProductVariant, SerialNumber, StockMovement
from app.schemas.product import (
    CategoryResponse, CategoryCreate, ProductResponse, ProductCreate,
    SerialNumberResponse, SerialNumberCreate
)
from app.auth import get_current_user
from app.utils.pagination import paginate_items

router = APIRouter(prefix="/inventory", tags=["Inventory & IMEI Tracking"])

@router.get("/categories", response_model=List[CategoryResponse])
def list_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Category).filter(
        Category.business_id == current_user.business_id,
        Category.is_active == True
    ).all()

@router.post("/categories", response_model=CategoryResponse)
def create_category(cat: CategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c_obj = Category(business_id=current_user.business_id, **cat.model_dump())
    db.add(c_obj)
    db.commit()
    db.refresh(c_obj)
    return c_obj

@router.get("/products")
def list_products(
    category_id: Optional[int] = None,
    brand: Optional[str] = None,
    search: Optional[str] = None,
    low_stock_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Product).filter(
        Product.business_id == current_user.business_id,
        Product.is_active == True
    )

    if category_id:
        query = query.filter(Product.category_id == category_id)
    if brand:
        query = query.filter(Product.brand == brand)
    if low_stock_only:
        query = query.filter(Product.current_stock <= Product.min_stock_level)
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                Product.name.ilike(s),
                Product.brand.ilike(s),
                Product.model.ilike(s),
                Product.barcode.ilike(s),
                Product.sku.ilike(s)
            )
        )

    products = query.all()
    is_staff = (current_user.role.code == "STAFF") if current_user.role else False

    results = []
    for p in products:
        p_resp = ProductResponse.model_validate(p)
        p_resp.category_name = p.category.name if p.category else None
        if is_staff:
            p_resp.purchase_cost = 0.0 # Mask purchase cost for sales staff!
        results.append(p_resp)
    return paginate_items(results, page=page, page_size=page_size)

@router.post("/products", response_model=ProductResponse)
def create_product(
    prod_in: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    data = prod_in.model_dump()
    initial_stock = data.pop("initial_stock", 0)
    initial_imeis = data.pop("initial_imeis", [])

    prod = Product(
        business_id=current_user.business_id,
        current_stock=len(initial_imeis) if (prod_in.is_serialized and initial_imeis) else initial_stock,
        **data
    )
    db.add(prod)
    db.flush()

    # If serialized and IMEIs provided
    if prod.is_serialized and initial_imeis:
        for imei in initial_imeis:
            imei_clean = imei.strip()
            if imei_clean:
                # Check duplicate
                exists = db.query(SerialNumber).filter(
                    SerialNumber.business_id == current_user.business_id,
                    SerialNumber.imei1 == imei_clean
                ).first()
                if exists:
                    raise HTTPException(status_code=400, detail=f"Duplicate IMEI {imei_clean} already exists!")

                s_obj = SerialNumber(
                    business_id=current_user.business_id,
                    product_id=prod.id,
                    imei1=imei_clean,
                    purchase_cost=prod.purchase_cost,
                    selling_price=prod.selling_price,
                    status="IN_STOCK"
                )
                db.add(s_obj)

    # Record Stock Movement
    if prod.current_stock > 0:
        mov = StockMovement(
            business_id=current_user.business_id,
            product_id=prod.id,
            movement_type="PURCHASE",
            quantity=prod.current_stock,
            previous_stock=0,
            current_stock=prod.current_stock,
            notes="Initial opening stock setup"
        )
        db.add(mov)

    db.commit()
    db.refresh(prod)
    p_resp = ProductResponse.model_validate(prod)
    p_resp.category_name = prod.category.name if prod.category else None
    return p_resp

@router.get("/serial-numbers", response_model=List[SerialNumberResponse])
def list_serial_numbers(
    product_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(SerialNumber).filter(SerialNumber.business_id == current_user.business_id)
    if product_id:
        query = query.filter(SerialNumber.product_id == product_id)
    if status_filter:
        query = query.filter(SerialNumber.status == status_filter.upper())

    serials = query.order_by(SerialNumber.id.desc()).all()
    is_staff = (current_user.role.code == "STAFF") if current_user.role else False

    results = []
    for s in serials:
        sr = SerialNumberResponse.model_validate(s)
        sr.product_name = s.product.name if s.product else None
        sr.brand = s.product.brand if s.product else None
        sr.model = s.product.model if s.product else None
        if is_staff:
            sr.purchase_cost = 0.0 # Mask purchase cost
        results.append(sr)
    return results

@router.get("/serial-numbers/search")
def search_imei_or_barcode(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ultra-fast search by IMEI, Serial Number, or Barcode for POS checkout.
    """
    clean_q = q.strip()
    is_staff = (current_user.role.code == "STAFF") if current_user.role else False

    # 1. Search Serial Numbers / IMEIs
    serial = db.query(SerialNumber).filter(
        SerialNumber.business_id == current_user.business_id,
        or_(
            SerialNumber.imei1.ilike(f"%{clean_q}%"),
            SerialNumber.imei2.ilike(f"%{clean_q}%"),
            SerialNumber.serial_number.ilike(f"%{clean_q}%")
        )
    ).first()

    if serial:
        return {
            "type": "SERIAL_DEVICE",
            "found": True,
            "serial_id": serial.id,
            "product_id": serial.product_id,
            "product_name": serial.product.name,
            "brand": serial.product.brand,
            "model": serial.product.model,
            "color": serial.color,
            "ram": serial.ram,
            "storage": serial.storage,
            "imei1": serial.imei1,
            "imei2": serial.imei2,
            "serial_number": serial.serial_number,
            "selling_price": serial.selling_price or serial.product.selling_price,
            "mrp": serial.product.mrp,
            "gst_rate": serial.product.gst_rate,
            "hsn_code": serial.product.hsn_code,
            "status": serial.status,
            "is_available": serial.status == "IN_STOCK",
            "purchase_cost": 0.0 if is_staff else serial.purchase_cost
        }

    # 2. Search Product by Barcode or SKU
    prod = db.query(Product).filter(
        Product.business_id == current_user.business_id,
        or_(Product.barcode == clean_q, Product.sku == clean_q),
        Product.is_active == True
    ).first()

    if prod:
        return {
            "type": "PRODUCT",
            "found": True,
            "product_id": prod.id,
            "product_name": prod.name,
            "brand": prod.brand,
            "model": prod.model,
            "selling_price": prod.selling_price,
            "mrp": prod.mrp,
            "gst_rate": prod.gst_rate,
            "hsn_code": prod.hsn_code,
            "current_stock": prod.current_stock,
            "is_serialized": prod.is_serialized,
            "is_available": prod.current_stock > 0,
            "purchase_cost": 0.0 if is_staff else prod.purchase_cost
        }

    return {"found": False, "message": "No matching device or product found"}

@router.post("/serial-numbers/{serial_id}/status")
def update_serial_status(
    serial_id: int,
    status_update: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_status = status_update.get("status", "").upper()
    valid_statuses = ["IN_STOCK", "RESERVED", "SOLD", "RETURNED", "DAMAGED", "UNDER_REPAIR", "TRANSFERRED"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")

    serial = db.query(SerialNumber).filter(
        SerialNumber.id == serial_id,
        SerialNumber.business_id == current_user.business_id
    ).first()
    if not serial:
        raise HTTPException(status_code=404, detail="Serial number not found")

    old_status = serial.status
    serial.status = new_status
    if status_update.get("notes"):
        serial.notes = status_update.get("notes")

    # Update product current_stock if moving into or out of IN_STOCK
    if old_status != "IN_STOCK" and new_status == "IN_STOCK":
        serial.product.current_stock += 1
    elif old_status == "IN_STOCK" and new_status != "IN_STOCK":
        serial.product.current_stock = max(0, serial.product.current_stock - 1)

    db.commit()
    return {"success": True, "serial_id": serial.id, "new_status": new_status}
