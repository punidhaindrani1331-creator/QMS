from fastapi import APIRouter, Depends, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.schemas.ticket import TicketCreate, TicketResponse, TicketStatusUpdate
from app.services.ticket import TicketService

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

@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    ticket: TicketCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    return TicketService.create_ticket(db=db, ticket_in=ticket, background_tasks=background_tasks)

@router.get("", response_model=list[TicketResponse])
def read_tickets(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return TicketService.get_tickets(db=db, skip=skip, limit=limit)

@router.get("/{ticket_id}", response_model=TicketResponse)
def read_ticket(ticket_id: int, db: Session = Depends(get_db)):
    return TicketService.get_ticket_by_id(db=db, ticket_id=ticket_id)

@router.put("/{ticket_id}/status", response_model=TicketResponse)
def update_ticket_status(
    ticket_id: int,
    status_update: TicketStatusUpdate,
    db: Session = Depends(get_db)
):
    return TicketService.update_ticket_status(db=db, ticket_id=ticket_id, new_status=status_update.status)
