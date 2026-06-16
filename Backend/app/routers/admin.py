import os
import json
import csv
import io
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.database import SessionLocal
from app.models.ticket import Ticket
from app.models.user import User
from app.utils.security import require_admin

router = APIRouter(
    prefix="/admin",
    tags=["Admin Operations"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "settings.json")

class SystemSettings(BaseModel):
    wait_time_per_ticket: int
    default_priority: str = "Medium"

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"wait_time_per_ticket": 12, "default_priority": "Medium"}

def save_settings(settings: dict):
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump(settings, f, indent=4)
        return True
    except Exception:
        return False

# ── GET Reports Stats (Admin Only) ───────────────────────────────────────────
@router.get("/reports/stats")
def get_reports_stats(db: Session = Depends(get_db), _: object = Depends(require_admin)):
    # Ticket status counts
    status_counts = db.query(Ticket.status, func.count(Ticket.id)).group_by(Ticket.status).all()
    status_map = {status: count for status, count in status_counts}

    # Ticket priority counts
    priority_counts = db.query(func.coalesce(Ticket.priority, 'Medium'), func.count(Ticket.id)).group_by(func.coalesce(Ticket.priority, 'Medium')).all()
    priority_map = {priority: count for priority, count in priority_counts}

    # Ticket category counts
    category_counts = db.query(Ticket.category, func.count(Ticket.id)).group_by(Ticket.category).all()
    category_map = {category or "Uncategorized": count for category, count in category_counts}

    # User role counts
    user_counts = db.query(User.role, func.count(User.id)).group_by(User.role).all()
    user_map = {role: count for role, count in user_counts}

    # General Stats
    total_tickets = db.query(Ticket).count()
    pending_tickets = db.query(Ticket).filter(Ticket.status == "Pending").all()
    
    settings = load_settings()
    wait_time = settings.get("wait_time_per_ticket", 12)
    avg_estimated_wait = len(pending_tickets) * wait_time

    return {
        "tickets": {
            "total": total_tickets,
            "status": {
                "Pending": status_map.get("Pending", 0),
                "In Progress": status_map.get("In Progress", 0),
                "Completed": status_map.get("Completed", 0),
            },
            "priority": {
                "Low": priority_map.get("Low", 0),
                "Medium": priority_map.get("Medium", 0),
                "High": priority_map.get("High", 0),
                "Critical": priority_map.get("Critical", 0),
            },
            "category": category_map
        },
        "users": user_map,
        "queue": {
            "pending_count": len(pending_tickets),
            "estimated_total_wait_mins": avg_estimated_wait,
            "wait_time_per_ticket_setting": wait_time
        }
    }

# ── GET Export Tickets CSV (Admin Only) ──────────────────────────────────────
@router.get("/reports/export")
def export_tickets_csv(db: Session = Depends(get_db), _: object = Depends(require_admin)):
    tickets = db.query(Ticket).order_by(Ticket.id.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "Ticket ID", "Client Name", "Client Email", "Subject", "Description", 
        "Status", "Priority", "Category", "Assigned To", "Queue Position", 
        "Estimated Wait", "Created At"
    ])
    
    # Data Rows
    for t in tickets:
        writer.writerow([
            t.id, t.client_name, t.client_email, t.subject, t.description,
            t.status, t.priority, t.category or "", t.assigned_to or "Unassigned",
            t.queue_position or "", t.estimated_wait or "", 
            t.created_at.strftime("%Y-%m-%d %H:%M:%S") if t.created_at else ""
        ])
        
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": "attachment; filename=qms_tickets_report.csv"}
    )

# ── GET Settings (Admin Only) ────────────────────────────────────────────────
@router.get("/settings", response_model=SystemSettings)
def get_settings(_: object = Depends(require_admin)):
    return load_settings()

# ── PUT Settings (Admin Only) ────────────────────────────────────────────────
@router.put("/settings", response_model=SystemSettings)
def update_settings(settings: SystemSettings, _: object = Depends(require_admin)):
    save_settings(settings.model_dump())
    
    # Recalculate estimated wait times for all pending tickets immediately!
    db = SessionLocal()
    try:
        from app.services.ticket import _recalculate_queue
        _recalculate_queue(db)
        
        # Broadcast the update to refresh wait times on all client interfaces
        from app.utils.websocket import broadcast_event
        # Send empty data to trigger generic dashboard refreshes
        broadcast_event("settings_updated", settings.model_dump())
    except Exception as e:
        print(f"[SETTINGS UPDATE RECALC ERROR] {e}")
    finally:
        db.close()
        
    return settings
