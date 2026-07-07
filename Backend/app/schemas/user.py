from pydantic import BaseModel, EmailStr, Field
from typing import Optional

from app.constants import UserRole


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="User's full name")
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    role: Optional[UserRole] = UserRole.CUSTOMER
    phone_number: Optional[str] = Field(None, max_length=20)
    department: Optional[str] = Field(None, max_length=100)


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    phone_number: Optional[str] = None
    department: Optional[str] = None

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


class UserLogin(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
