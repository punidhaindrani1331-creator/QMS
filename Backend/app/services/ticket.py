import threading
from sqlalchemy.orm import Session
from fastapi import BackgroundTasks, HTTPException, status
from app.models.ticket import Ticket
from app.schemas.ticket import TicketCreate
from app.utils.email_sender import send_ticket_confirmation, send_status_update_email

# Minutes allocated per pending ticket in the queue
WAIT_PER_TICKET_MINS = 12


def get_wait_time_mins() -> int:
    import json
    import os
    settings_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "settings.json")
    if os.path.exists(settings_file):
        try:
            with open(settings_file, "r") as f:
                data = json.load(f)
                return int(data.get("wait_time_per_ticket", 12))
        except Exception:
            pass
    return WAIT_PER_TICKET_MINS


def _recalculate_queue(db: Session):
    """Recalculate queue_position and estimated_wait for all Pending tickets."""
    wait_time = get_wait_time_mins()
    pending = (
        db.query(Ticket)
        .filter(Ticket.status == "Pending")
        .order_by(Ticket.created_at.asc())
        .all()
    )
    for pos, ticket in enumerate(pending, start=1):
        ticket.queue_position = pos
        ticket.estimated_wait = pos * wait_time
    db.commit()



class TicketService:
    @staticmethod
    def create_ticket(db: Session, ticket_in: TicketCreate,
                      background_tasks: BackgroundTasks = None) -> Ticket:
        db_ticket = Ticket(
            client_name=ticket_in.client_name,
            client_email=ticket_in.client_email,
            subject=ticket_in.subject,
            description=ticket_in.description,
            priority=ticket_in.priority or "Medium",
            category=ticket_in.category,
            status="Pending"
        )
        db.add(db_ticket)
        db.commit()
        db.refresh(db_ticket)

        # Recalculate queue positions after inserting the new ticket
        _recalculate_queue(db)
        db.refresh(db_ticket)   # pick up the freshly computed position/wait

        # Send confirmation email
        email_args = (
            db_ticket.client_email,
            db_ticket.client_name,
            db_ticket.id,
            db_ticket.subject,
        )
        if background_tasks:
            print(f"[EMAIL] Scheduling confirmation for ticket #{db_ticket.id} → {db_ticket.client_email}")
            background_tasks.add_task(send_ticket_confirmation, *email_args)
        else:
            # Called from email_receiver thread — run in a daemon thread to avoid blocking
            t = threading.Thread(target=send_ticket_confirmation, args=email_args, daemon=True)
            t.start()

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
    def update_ticket_status(db: Session, ticket_id: int, new_status: str,
                              background_tasks: BackgroundTasks = None) -> Ticket:
        ticket = TicketService.get_ticket_by_id(db, ticket_id)
        ticket.status = new_status

        # Clear queue position when ticket leaves the pending queue
        if new_status != "Pending":
            ticket.queue_position = None
            ticket.estimated_wait = None if new_status == "Completed" else ticket.estimated_wait

        db.commit()
        db.refresh(ticket)

        # Recalculate positions for remaining pending tickets
        _recalculate_queue(db)

        # Send status update email (non-blocking)
        email_args = (
            ticket.client_email,
            ticket.client_name,
            ticket.id,
            ticket.subject,
            new_status,
            ticket.estimated_wait,
        )
        if background_tasks:
            background_tasks.add_task(send_status_update_email, *email_args)
        else:
            t = threading.Thread(target=send_status_update_email, args=email_args, daemon=True)
            t.start()

        print(f"[STATUS] Ticket #{ticket_id} → {new_status} | email queued for {ticket.client_email}")
        return ticket

    @staticmethod
    def assign_ticket(db: Session, ticket_id: int, assigned_to: str) -> Ticket:
        ticket = TicketService.get_ticket_by_id(db, ticket_id)
        ticket.assigned_to = assigned_to
        db.commit()
        db.refresh(ticket)
        return ticket

    @staticmethod
    def get_tickets(db: Session, skip: int = 0, limit: int = 100):
        return db.query(Ticket).order_by(Ticket.id.desc()).offset(skip).limit(limit).all()
