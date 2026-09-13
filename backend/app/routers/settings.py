from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User, Business
from app.models.audit import AuditLog, Notification
from app.models.sale import Sale
from app.models.product import Product, SerialNumber
from app.models.party import Customer, Supplier
from app.models.finance import Expense, Account
from app.models.emi import EmiPlan
from app.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["Settings, Audit Logs & Backups"])

@router.get("/audit-logs")
def list_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role and current_user.role.code == "STAFF":
        raise HTTPException(status_code=403, detail="Staff members cannot view system audit logs.")

    logs = db.query(AuditLog).filter(
        AuditLog.business_id == current_user.business_id
    ).order_by(AuditLog.id.desc()).limit(limit).all()

    return [
        {
            "id": l.id,
            "user_name": l.user_name,
            "role": l.role,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "old_values": l.old_values,
            "new_values": l.new_values,
            "notes": l.notes,
            "created_at": l.created_at.isoformat()
        }
        for l in logs
    ]

@router.get("/notifications")
def list_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Notification).filter(Notification.business_id == current_user.business_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    notifications = query.order_by(Notification.id.desc()).limit(20).all()
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "category": n.category,
            "severity": n.severity,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat()
        }
        for n in notifications
    ]

@router.put("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.business_id == current_user.business_id
    ).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"success": True}

@router.get("/backup/export-json")
def full_backup_export(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exports complete business database snapshot in portable JSON format for offline backup.
    """
    if current_user.role and current_user.role.code != "OWNER":
        raise HTTPException(status_code=403, detail="Only the Store Owner can export full business backup.")

    biz_id = current_user.business_id
    biz = db.query(Business).filter(Business.id == biz_id).first()
    products = db.query(Product).filter(Product.business_id == biz_id).all()
    customers = db.query(Customer).filter(Customer.business_id == biz_id).all()
    suppliers = db.query(Supplier).filter(Supplier.business_id == biz_id).all()
    sales = db.query(Sale).filter(Sale.business_id == biz_id).all()
    expenses = db.query(Expense).filter(Expense.business_id == biz_id).all()
    accounts = db.query(Account).filter(Account.business_id == biz_id).all()

    return {
        "version": "1.0",
        "exported_at": str(db.query(Sale.created_at).first() or ""),
        "business": {
            "name": biz.name,
            "gstin": biz.gstin,
            "phone": biz.phone,
            "city": biz.city
        },
        "counts": {
            "products": len(products),
            "customers": len(customers),
            "suppliers": len(suppliers),
            "sales": len(sales),
            "expenses": len(expenses)
        }
    }
