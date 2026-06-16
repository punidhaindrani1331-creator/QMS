from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class TicketCreate(BaseModel):
    client_name: str
    client_email: EmailStr
    subject: str
    description: str
    priority: Optional[str] = "Medium"
    category: Optional[str] = None


class TicketStatusUpdate(BaseModel):
    status: str


class TicketAssignUpdate(BaseModel):
    assigned_to: str


class TicketResponse(BaseModel):
    id: int
    client_name: str
    client_email: str
    subject: str
    description: str
    status: str
    priority: Optional[str] = "Medium"
    category: Optional[str] = None
    assigned_to: Optional[str] = None
    queue_position: Optional[int] = None
    estimated_wait: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
