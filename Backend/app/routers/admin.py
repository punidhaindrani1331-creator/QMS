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
from app.dependencies import get_db
from app.models.ticket import Ticket
from app.models.user import User
from app.utils.security import require_admin
from app.utils.logger import email_logger
from app.constants import DEFAULT_WAIT_TIME_MINS, DEFAULT_PRIORITY

router = APIRouter(
    prefix="/admin",
    tags=["Admin Operations"]
)

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "settings.json")

class SystemSettings(BaseModel):
    wait_time_per_ticket: int
    default_priority: str = "Medium"

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            email_logger.warning(f"Failed to load settings from {SETTINGS_FILE}: {e}")
    return {"wait_time_per_ticket": DEFAULT_WAIT_TIME_MINS, "default_priority": DEFAULT_PRIORITY}

def save_settings(settings: dict) -> bool:
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump(settings, f, indent=4)
        email_logger.info(f"Settings saved to {SETTINGS_FILE}")
        return True
    except Exception as e:
        email_logger.error(f"Failed to save settings to {SETTINGS_FILE}: {e}")
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
        email_logger.error(f"Failed to recalculate queue after settings update: {e}")
    finally:
        db.close()
        
    return settings


# ── POST Reprocess Inbox (Admin Only) ───────────────────────────────────────
@router.post("/reprocess-inbox")
def reprocess_inbox(
    hours: int = 24,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin)
):
    """
    Admin-only: re-scan the Gmail inbox for emails from the last N hours (default 24).
    Useful when an email was accidentally read in Gmail before the backend could process it.
    Skips emails that already have a matching ticket in the DB.
    """
    import imaplib
    import email as email_lib
    from email.header import decode_header
    from datetime import datetime, timedelta, timezone
    from app.utils.email_receiver import (
        EMAIL_USER, EMAIL_PASS, parse_sender, get_email_body,
        is_valid_query, categorize_email, clean_text
    )
    from app.utils.email_sender import send_ticket_confirmation, send_rejection_email
    from app.schemas.ticket import TicketCreate
    from app.services.ticket import TicketService

    if not EMAIL_USER or not EMAIL_PASS:
        raise HTTPException(status_code=500, detail="Email credentials not configured.")

    results = {"processed": [], "skipped_duplicate": [], "rejected": [], "errors": []}

    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
        mail.login(EMAIL_USER, EMAIL_PASS)
        mail.select("inbox")

        # Search emails from the past N hours
        since_date = (datetime.now(timezone.utc) - timedelta(hours=hours)).strftime("%d-%b-%Y")
        status, response = mail.search(None, f'(SINCE "{since_date}")')
        email_ids = response[0].split() if status == "OK" and response[0] else []

        email_logger.info(f"Found {len(email_ids)} emails since last {hours}h. Checking for missed ones")

        for e_id in email_ids:
            try:
                status, msg_data = mail.fetch(e_id, "(RFC822)")
                for part in msg_data:
                    if not isinstance(part, tuple):
                        continue
                    msg = email_lib.message_from_bytes(part[1])

                    # Decode subject
                    raw_subj, enc = decode_header(msg["Subject"])[0]
                    subject = raw_subj.decode(enc or "utf-8", errors="ignore") if isinstance(raw_subj, bytes) else clean_text(raw_subj or "No Subject")

                    # Parse sender
                    client_name, client_email = parse_sender(msg.get("From"))

                    # Skip system emails / self-sent
                    if not client_email or client_email.lower() == EMAIL_USER.lower() \
                            or "mailer-daemon" in client_email.lower() \
                            or "postmaster" in client_email.lower() \
                            or "no-reply" in client_email.lower() \
                            or "noreply" in client_email.lower():
                        continue

                    # Check if a ticket already exists for this subject + email
                    existing = db.query(Ticket).filter(
                        Ticket.client_email == client_email,
                        Ticket.subject == subject
                    ).first()
                    if existing:
                        results["skipped_duplicate"].append(
                            {"email": client_email, "subject": subject, "ticket_id": existing.id}
                        )
                        continue

                    # Extract body
                    description = get_email_body(msg)

                    # Filter
                    if not is_valid_query(subject, description):
                        results["rejected"].append({"email": client_email, "subject": subject})
                        try:
                            send_rejection_email(client_email, client_name, subject)
                        except Exception:
                            pass
                        continue

                    # Create ticket
                    category = categorize_email(subject, description)
                    ticket_in = TicketCreate(
                        client_name=client_name,
                        client_email=client_email,
                        subject=subject,
                        description=description.strip(),
                        category=category
                    )
                    new_ticket = TicketService.create_ticket(db=db, ticket_in=ticket_in)
                    results["processed"].append(
                        {"email": client_email, "subject": subject, "ticket_id": new_ticket.id}
                    )
                    email_logger.info(f"Reprocessed: Ticket #{new_ticket.id} created for {client_email}")

            except Exception as ex:
                results["errors"].append({"email_id": e_id.decode(), "error": str(ex)})

        mail.logout()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inbox reprocess failed: {e}")

    return {
        "message": f"Inbox reprocessed for last {hours} hours.",
        "summary": {
            "new_tickets_created": len(results["processed"]),
            "already_ticketed_skipped": len(results["skipped_duplicate"]),
            "rejected_non_query": len(results["rejected"]),
            "errors": len(results["errors"]),
        },
        "details": results
    }
