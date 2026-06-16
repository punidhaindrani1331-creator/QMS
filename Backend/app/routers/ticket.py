from fastapi import APIRouter, Depends, status, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.schemas.ticket import TicketCreate, TicketResponse, TicketStatusUpdate, TicketAssignUpdate
from app.services.ticket import TicketService
from app.utils.security import require_staff, get_current_user

router = APIRouter(
    prefix="/tickets",
    tags=["Tickets"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper to serialize ticket for WebSocket JSON broadcasts
def serialize_ticket(ticket):
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
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None
    }

# ── Create Ticket (Authenticated) ───────────────────────────────────────────
@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    ticket: TicketCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models.user import User
    db_user = db.query(User).filter(User.email == current_user["sub"]).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="User session invalid")

    # For Customers, override sent client details with account details for security
    if db_user.role.lower() == "customer":
        ticket.client_name = db_user.name
        ticket.client_email = db_user.email

    res = TicketService.create_ticket(db=db, ticket_in=ticket, background_tasks=background_tasks)
    
    # Broadcast ticket creation
    from app.utils.websocket import broadcast_event
    broadcast_event("ticket_created", serialize_ticket(res))
    
    return res

# ── Read Tickets (RBAC filtered) ─────────────────────────────────────────────
@router.get("", response_model=list[TicketResponse])
def read_tickets(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models.user import User
    db_user = db.query(User).filter(User.email == current_user["sub"]).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="User session invalid")

    # Staff & Admin see all tickets
    if db_user.role.lower() in ("staff", "admin"):
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
    current_user: dict = Depends(get_current_user)
):
    from app.models.user import User
    db_user = db.query(User).filter(User.email == current_user["sub"]).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="User session invalid")

    ticket = TicketService.get_ticket_by_id(db=db, ticket_id=ticket_id)

    # Customer check
    if db_user.role.lower() == "customer" and ticket.client_email != db_user.email:
        raise HTTPException(status_code=403, detail="Not authorized to view this ticket")

    return ticket

# ── Update Ticket Status (Staff/Admin only) ───────────────────────────
@router.put("/{ticket_id}/status", response_model=TicketResponse)
def update_ticket_status(
    ticket_id: int,
    status_update: TicketStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    res = TicketService.update_ticket_status(
        db=db,
        ticket_id=ticket_id,
        new_status=status_update.status,
        background_tasks=background_tasks
    )
    
    # Broadcast ticket status change
    from app.utils.websocket import broadcast_event
    broadcast_event("ticket_updated", serialize_ticket(res))
    
    return res

# ── Assign Ticket (Staff/Admin only) ─────────────────────────────────
@router.put("/{ticket_id}/assign", response_model=TicketResponse)
def assign_ticket(
    ticket_id: int,
    assign: TicketAssignUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    res = TicketService.assign_ticket(db=db, ticket_id=ticket_id, assigned_to=assign.assigned_to)
    
    # Broadcast ticket assignment
    from app.utils.websocket import broadcast_event
    broadcast_event("ticket_updated", serialize_ticket(res))
    
    return res
