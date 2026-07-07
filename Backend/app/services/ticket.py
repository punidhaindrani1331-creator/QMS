import threading
import json
import os
from sqlalchemy.orm import Session
from fastapi import BackgroundTasks, HTTPException, status

from app.constants import TicketStatus, TicketPriority, DEFAULT_WAIT_TIME_MINS
from app.models.ticket import Ticket
from app.schemas.ticket import TicketCreate
from app.utils.email_sender import send_ticket_confirmation, send_status_update_email
from app.utils.logger import email_logger


def get_wait_time_mins() -> int:
    """
    Read the per-ticket wait time from settings.json.
    Falls back to DEFAULT_WAIT_TIME_MINS and logs a warning on any read/parse error.
    """
    settings_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "settings.json",
    )
    if not os.path.exists(settings_file):
        return DEFAULT_WAIT_TIME_MINS

    try:
        with open(settings_file, "r") as f:
            data = json.load(f)
        value = data.get("wait_time_per_ticket", DEFAULT_WAIT_TIME_MINS)
        return int(value)
    except (OSError, ValueError, TypeError) as exc:
        email_logger.warning(f"Could not read wait_time_per_ticket from settings: {exc}. Using default {DEFAULT_WAIT_TIME_MINS} min")
        return DEFAULT_WAIT_TIME_MINS


def _recalculate_queue(db: Session) -> None:
    """Recalculate queue_position and estimated_wait for all Pending tickets."""
    wait_time = get_wait_time_mins()
    pending = (
        db.query(Ticket)
        .filter(Ticket.status == TicketStatus.PENDING)
        .order_by(Ticket.created_at.asc())
        .all()
    )
    for pos, ticket in enumerate(pending, start=1):
        ticket.queue_position = pos
        ticket.estimated_wait = pos * wait_time
    db.commit()


def _send_in_thread(target, args: tuple, timeout: int = 30) -> None:
    """Run an email-sending function in a non-daemon thread with a join timeout."""
    t = threading.Thread(target=target, args=args, daemon=False)
    t.start()
    t.join(timeout=timeout)


class TicketService:

    @staticmethod
    def create_ticket(
        db: Session,
        ticket_in: TicketCreate,
        background_tasks: BackgroundTasks = None,
    ) -> Ticket:
        db_ticket = Ticket(
            client_name=ticket_in.client_name,
            client_email=ticket_in.client_email,
            subject=ticket_in.subject,
            description=ticket_in.description,
            priority=ticket_in.priority or TicketPriority.MEDIUM,
            category=ticket_in.category,
            status=TicketStatus.PENDING,
        )
        db.add(db_ticket)
        db.commit()
        db.refresh(db_ticket)

        _recalculate_queue(db)
        db.refresh(db_ticket)

        email_args = (
            db_ticket.client_email,
            db_ticket.client_name,
            db_ticket.id,
            db_ticket.subject,
        )
        if background_tasks:
            background_tasks.add_task(send_ticket_confirmation, *email_args)
        else:
            _send_in_thread(send_ticket_confirmation, email_args)

        return db_ticket

    @staticmethod
    def get_ticket_by_id(db: Session, ticket_id: int) -> Ticket:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found",
            )
        return ticket

    @staticmethod
    def update_ticket_status(
        db: Session,
        ticket_id: int,
        new_status: str,
        background_tasks: BackgroundTasks = None,
    ) -> Ticket:
        ticket = TicketService.get_ticket_by_id(db, ticket_id)
        ticket.status = new_status

        if new_status != TicketStatus.PENDING:
            ticket.queue_position = None
        if new_status == TicketStatus.COMPLETED:
            ticket.estimated_wait = None

        db.commit()
        db.refresh(ticket)
        _recalculate_queue(db)

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
            _send_in_thread(send_status_update_email, email_args)

        email_logger.info(f"Ticket #{ticket_id} status updated to {new_status} | email queued for {ticket.client_email}")
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
