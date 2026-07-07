import threading
from fastapi import APIRouter, Depends, status, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session

from app.constants import STAFF_ROLES
from app.dependencies import get_db
from app.models.message import Message
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.message import MessageCreate, MessageResponse
from app.utils.security import get_current_user
from app.utils.email_sender import send_reply_notification

router = APIRouter(prefix="/tickets/{ticket_id}/messages", tags=["Messages"])


def _serialize_message(msg) -> dict:
    """Serialize a Message ORM object for WebSocket broadcasts."""
    return {
        "id": msg.id,
        "ticket_id": msg.ticket_id,
        "sender_id": msg.sender_id,
        "sender_name": msg.sender_name,
        "sender_role": msg.sender_role,
        "content": msg.content,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


def _get_authorized_user_and_ticket(
    ticket_id: int,
    db: Session,
    current_user: dict,
):
    """
    Shared authorization helper for message endpoints.
    Returns (db_user, ticket, is_staff_or_admin).
    Raises 401/403/404 as appropriate.
    """
    from app.utils.auth_helpers import resolve_user_from_token

    db_user = resolve_user_from_token(db, current_user)

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    is_staff_or_admin = db_user.role in STAFF_ROLES
    is_ticket_owner = ticket.client_email.lower() == db_user.email.lower()

    if not (is_staff_or_admin or is_ticket_owner):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access replies for this ticket",
        )
    return db_user, ticket, is_staff_or_admin


# ── Create Chat Message (Authenticated) ──────────────────────────────────────
@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def create_message(
    ticket_id: int,
    message_in: MessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    db_user, ticket, is_staff_or_admin = _get_authorized_user_and_ticket(
        ticket_id, db, current_user
    )

    db_message = Message(
        ticket_id=ticket_id,
        sender_id=db_user.id,
        sender_name=db_user.name,
        sender_role=db_user.role,
        content=message_in.content,
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    from app.utils.websocket import broadcast_event
    broadcast_event("message_created", _serialize_message(db_message))

    # Notify the customer by email when staff/admin replies
    if is_staff_or_admin:
        email_args = (
            ticket.client_email,
            ticket.client_name,
            ticket.id,
            ticket.subject,
            db_message.content,
            db_user.name,
        )
        if background_tasks:
            background_tasks.add_task(send_reply_notification, *email_args)
        else:
            t = threading.Thread(target=send_reply_notification, args=email_args, daemon=False)
            t.start()
            t.join(timeout=30)

    return db_message


# ── Get Chat Messages (Authenticated) ────────────────────────────────────────
@router.get("", response_model=list[MessageResponse])
def get_messages(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _get_authorized_user_and_ticket(ticket_id, db, current_user)

    return (
        db.query(Message)
        .filter(Message.ticket_id == ticket_id)
        .order_by(Message.created_at.asc())
        .all()
    )
