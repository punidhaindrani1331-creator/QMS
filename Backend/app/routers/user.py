from fastapi import APIRouter, Depends, status, Header
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.constants import UserRole
from app.dependencies import get_db
from app.schemas.user import UserCreate, UserResponse, UserLogin, Token
from app.services.user import UserService
from app.utils.security import decode_access_token, require_admin, require_staff


class RoleUpdate(BaseModel):
    role: str


router = APIRouter(prefix="/users", tags=["Users"])


# ── Public: Customer self-registration ───────────────────────────────────────
@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_customer(user: UserCreate, db: Session = Depends(get_db)):
    """Anyone can register — always creates a Customer account."""
    return UserService.create_user(db=db, user_in=user)


# ── Public: Login ─────────────────────────────────────────────────────────────
@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    access_token = UserService.authenticate_user(db=db, credentials=credentials)
    return {"access_token": access_token, "token_type": "bearer"}


# ── Authenticated: current user info ─────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.utils.auth_helpers import resolve_user_from_token

    return resolve_user_from_token(db, current_user)


# ── Admin only: list all users ────────────────────────────────────────────────
@router.get("", response_model=list[UserResponse])
def read_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    return UserService.get_users(db=db, skip=skip, limit=limit)


# ── Admin only: create a Staff account ───────────────────────────────────────
@router.post("/staff", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_staff(
    user: UserCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    """Admin creates a Staff account — staff cannot self-register."""
    return UserService.create_staff(db=db, user_in=user)


# ── Admin only: change any user's role ───────────────────────────────────────
@router.put("/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    body: RoleUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    return UserService.update_user_role(db=db, user_id=user_id, new_role=body.role)


# ── Staff/Admin: get a single user by id ─────────────────────────────────────
@router.get("/{user_id}", response_model=UserResponse)
def read_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_staff),
):
    return UserService.get_user_by_id(db=db, user_id=user_id)
