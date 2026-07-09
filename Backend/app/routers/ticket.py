from fastapi import APIRouter, Depends, status, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session

from app.utils.constants import STAFF_ROLES
from app.utils.dependencies import get_db
from app.schemas.ticket import TicketCreate, TicketResponse, TicketStatusUpdate, TicketAssignUpdate
from app.services.ticket import TicketService
from app.utils.security import require_staff, get_current_user, require_staff_only

router = APIRouter(prefix="/tickets", tags=["Tickets"])


def _serialize_ticket(ticket) -> dict:
    """Serialize a Ticket ORM object to a plain dict for WebSocket broadcasts."""
    return {
        "id": ticket.id,
        "client_name": ticket.client_name,
        "client_email": ticket.client_email,
        "subject": ticket.subject,
        "description": ticket.description,
        "status": ticket.status,
        "priority": ticket.priority,
        "category": ticket.category,
        "assigned_to": ticket.assigned_to,
        "queue_position": ticket.queue_position,
        "estimated_wait": ticket.estimated_wait,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
    }


# ── Create Ticket (Authenticated) ────────────────────────────────────────────
@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    ticket: TicketCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from app.utils.auth_helpers import resolve_user_from_token

    db_user = resolve_user_from_token(db, current_user)

    # For Customers, override any client details with their verified account data
    if db_user.role not in STAFF_ROLES:
        ticket.client_name = db_user.name
        ticket.client_email = db_user.email

    res = TicketService.create_ticket(db=db, ticket_in=ticket, background_tasks=background_tasks)

    from app.utils.websocket import broadcast_event
    broadcast_event("ticket_created", _serialize_ticket(res))
    return res


# ── Read Tickets (RBAC filtered) ──────────────────────────────────────────────
@router.get("", response_model=list[TicketResponse])
def read_tickets(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from app.utils.auth_helpers import resolve_user_from_token

    db_user = resolve_user_from_token(db, current_user)

    if db_user.role in STAFF_ROLES:
        return TicketService.get_tickets(db=db, skip=skip, limit=limit)

    # Customers see only their own tickets
    from app.models.ticket import Ticket

    return (
        db.query(Ticket)
        .filter(Ticket.client_email == db_user.email)
        .order_by(Ticket.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ── Read Single Ticket (RBAC protected) ──────────────────────────────────────
@router.get("/{ticket_id}", response_model=TicketResponse)
def read_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from app.models.user import User

    db_user = db.query(User).filter(User.email == current_user["sub"]).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User session invalid")

    ticket = TicketService.get_ticket_by_id(db=db, ticket_id=ticket_id)

    if db_user.role not in STAFF_ROLES and ticket.client_email != db_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this ticket",
        )
    return ticket


# ── Update Ticket Status (Staff only) ────────────────────────────────────────
@router.put("/{ticket_id}/status", response_model=TicketResponse)
def update_ticket_status(
    ticket_id: int,
    status_update: TicketStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff_only),
):
    res = TicketService.update_ticket_status(
        db=db,
        ticket_id=ticket_id,
        new_status=status_update.status,
        background_tasks=background_tasks,
    )
    from app.utils.websocket import broadcast_event
    broadcast_event("ticket_updated", _serialize_ticket(res))
    return res


# ── Assign Ticket (Staff/Admin only) ─────────────────────────────────────────
@router.put("/{ticket_id}/assign", response_model=TicketResponse)
def assign_ticket(
    ticket_id: int,
    assign: TicketAssignUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    res = TicketService.assign_ticket(
        db=db, ticket_id=ticket_id, assigned_to=assign.assigned_to
    )
    from app.utils.websocket import broadcast_event
    broadcast_event("ticket_updated", _serialize_ticket(res))
    return res
