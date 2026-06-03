from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class TicketCreate(BaseModel):
    client_name: str
    client_email: EmailStr
    subject: str
    description: str
    

class TicketStatusUpdate(BaseModel):
    status: str

class TicketResponse(BaseModel):
    id: int
    client_name: str
    client_email: str
    subject: str
    description: str
    
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
