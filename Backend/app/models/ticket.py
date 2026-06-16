from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from app.database import Base

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String(100))
    client_email = Column(String(100), index=True)
    subject = Column(String(200))
    description = Column(Text)

    status = Column(String(50), default="Pending")
    priority = Column(String(20), default="Medium")   # Low / Medium / High / Critical
    category = Column(String(50), nullable=True)       # Bug / Billing / Request / Complaint
    assigned_to = Column(String(100), nullable=True)   # staff name or email
    queue_position = Column(Integer, nullable=True)
    estimated_wait = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
