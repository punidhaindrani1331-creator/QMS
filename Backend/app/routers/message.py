import threading
from fastapi import APIRouter, Depends, status, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.schemas.message import MessageCreate, MessageResponse
from app.models.message import Message
from app.models.ticket import Ticket
from app.models.user import User
from app.utils.security import get_current_user
from app.utils.email_sender import send_reply_notification

router = APIRouter(
    prefix="/tickets/{ticket_id}/messages",
    tags=["Messages"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper to serialize message for WebSocket
def serialize_message(msg):
    return {
        "id": msg.id,
        "ticket_id": msg.ticket_id,
        "sender_id": msg.sender_id,
        "sender_name": msg.sender_name,
        "sender_role": msg.sender_role,
        "content": msg.content,
        "created_at": msg.created_at.isoformat() if msg.created_at else None
    }

# ── Create Chat Message (Authenticated) ──────────────────────────────────────
@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def create_message(
    ticket_id: int,
    message_in: MessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    db_user = db.query(User).filter(User.email == current_user["sub"]).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="User session invalid")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Access check: Must be the ticket owner OR staff/admin
    is_staff_or_admin = db_user.role.lower() in ("staff", "admin")
    is_ticket_owner = ticket.client_email.lower() == db_user.email.lower()

    if not (is_staff_or_admin or is_ticket_owner):
        raise HTTPException(status_code=403, detail="Not authorized to post replies to this ticket")

    # Create message
    db_message = Message(
        ticket_id=ticket_id,
        sender_id=db_user.id,
        sender_name=db_user.name,
        sender_role=db_user.role,
        content=message_in.content
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    # Broadcast via WebSockets
    from app.utils.websocket import broadcast_event
    serialized = serialize_message(db_message)
    broadcast_event("message_created", serialized)

    # If Staff/Admin replied, send an email notification to the customer
    if is_staff_or_admin:
        email_args = (
            ticket.client_email,
            ticket.client_name,
            ticket.id,
            ticket.subject,
            db_message.content,
            db_user.name
        )
        if background_tasks:
            background_tasks.add_task(send_reply_notification, *email_args)
        else:
            t = threading.Thread(target=send_reply_notification, args=email_args, daemon=True)
            t.start()

    return db_message

# ── Get Chat Messages (Authenticated) ────────────────────────────────────────
@router.get("", response_model=list[MessageResponse])
def get_messages(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    db_user = db.query(User).filter(User.email == current_user["sub"]).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="User session invalid")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Access check: Must be ticket owner OR staff/admin
    is_staff_or_admin = db_user.role.lower() in ("staff", "admin")
    is_ticket_owner = ticket.client_email.lower() == db_user.email.lower()

    if not (is_staff_or_admin or is_ticket_owner):
        raise HTTPException(status_code=403, detail="Not authorized to view replies for this ticket")

    return (
        db.query(Message)
        .filter(Message.ticket_id == ticket_id)
        .order_by(Message.created_at.asc())
        .all()
    )
