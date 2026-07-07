from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional

from app.constants import TicketStatus, TicketPriority, TicketCategory


class TicketCreate(BaseModel):
    client_name: str = Field(..., min_length=1, max_length=100)
    client_email: EmailStr
    subject: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    priority: Optional[TicketPriority] = TicketPriority.MEDIUM
    category: Optional[TicketCategory] = None


class TicketStatusUpdate(BaseModel):
    status: TicketStatus

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: TicketStatus) -> TicketStatus:
        return v


class TicketAssignUpdate(BaseModel):
    assigned_to: str = Field(..., min_length=1, max_length=100)


class TicketResponse(BaseModel):
    id: int
    client_name: str
    client_email: str
    subject: str
    description: str
    status: str
    priority: Optional[str] = TicketPriority.MEDIUM
    category: Optional[str] = None
    assigned_to: Optional[str] = None
    queue_position: Optional[int] = None
    estimated_wait: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
