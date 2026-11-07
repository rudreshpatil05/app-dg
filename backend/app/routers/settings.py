import datetime
import json
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User, Business
from app.models.audit import AuditLog, Notification
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/settings", tags=["Settings, Audit Logs & Backups"])

@router.get("/audit-logs")
def list_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["OWNER"]))
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
    current_user: User = Depends(require_role(["OWNER"]))
):
    """
    Exports complete business database snapshot in portable JSON format for offline backup.
    """
    biz_id = current_user.business_id
    biz = db.query(Business).filter(Business.id == biz_id).first()
    from app.database import Base
    from app.models.auth import User

    models = {}
    for mapper in Base.registry.mappers:
        model = mapper.class_
        if model is User or not hasattr(model, "business_id"):
            continue
        models[model.__tablename__] = model

    def serialize(value):
        if isinstance(value, (datetime.date, datetime.datetime)):
            return value.isoformat()
        return value

    payload = {
        "version": "2.0",
        "exported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "business": {
            "id": biz.id,
            "name": biz.name,
            "gstin": biz.gstin,
            "phone": biz.phone,
            "city": biz.city
        },
        "tables": {}
    }
    for name, model in models.items():
        rows = db.query(model).filter(model.business_id == biz_id).all()
        payload["tables"][name] = [
            {column.name: serialize(getattr(row, column.name)) for column in model.__table__.columns}
            for row in rows
        ]

    content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="dg-retail-backup.json"'}
    )
