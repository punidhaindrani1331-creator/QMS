from sqlalchemy.orm import Session
from fastapi import BackgroundTasks, HTTPException, status
from app.models.ticket import Ticket
from app.schemas.ticket import TicketCreate
from email_sender import send_ticket_confirmation

class TicketService:
    @staticmethod
    def create_ticket(db: Session, ticket_in: TicketCreate, background_tasks: BackgroundTasks = None) -> Ticket:
        # We can add validation logic here (e.g. check if the client has too many open tickets)
        # For now, we will create the ticket directly.
        
        db_ticket = Ticket(
            client_name=ticket_in.client_name,
            client_email=ticket_in.client_email,
            subject=ticket_in.subject,
            description=ticket_in.description,
            
            status="Pending"
        )
        db.add(db_ticket)
        db.commit()
        db.refresh(db_ticket)
        
        # Validation passed & ticket stored -> Now trigger the auto-response in the background
        if background_tasks:
            print(f"[EMAIL] Scheduling confirmation email for ticket #{db_ticket.id} to {db_ticket.client_email}")
            background_tasks.add_task(
                send_ticket_confirmation,
                db_ticket.client_email,
                db_ticket.client_name,
                db_ticket.id,
                db_ticket.subject
            )
        else:
            # If no background_tasks provided (e.g. from script), send it synchronously
            print(f"[EMAIL] Sending confirmation email immediately for ticket #{db_ticket.id} to {db_ticket.client_email}")
            send_ticket_confirmation(
                db_ticket.client_email,
                db_ticket.client_name,
                db_ticket.id,
                db_ticket.subject
            )
        
        return db_ticket

    @staticmethod
    def get_ticket_by_id(db: Session, ticket_id: int) -> Ticket:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        return ticket

    @staticmethod
    def update_ticket_status(db: Session, ticket_id: int, new_status: str) -> Ticket:
        ticket = TicketService.get_ticket_by_id(db, ticket_id)
        ticket.status = new_status
        db.commit()
        db.refresh(ticket)
        return ticket

    @staticmethod
    def get_tickets(db: Session, skip: int = 0, limit: int = 100):
        # Retrieve recent tickets sorted by creation time or ID descending
        return db.query(Ticket).order_by(Ticket.id.desc()).offset(skip).limit(limit).all()
