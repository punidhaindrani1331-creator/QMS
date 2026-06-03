from fastapi import APIRouter, Depends, status, Header
from sqlalchemy.orm import Session
from typing import Optional
from app.database import SessionLocal
from app.schemas.user import UserCreate, UserResponse, UserLogin, Token
from app.services.user import UserService
from app.utils.security import decode_access_token

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    return UserService.create_user(db=db, user_in=user)

@router.get("", response_model=list[UserResponse])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return UserService.get_users(db=db, skip=skip, limit=limit)

# /login and /me must be defined BEFORE /{user_id} to avoid route conflict
@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    access_token = UserService.authenticate_user(db=db, credentials=credentials)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    from fastapi import HTTPException
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    email = payload.get("sub")
    user = UserService.get_user_by_email(db=db, email=email)
    return user

@router.get("/{user_id}", response_model=UserResponse)
def read_user(user_id: int, db: Session = Depends(get_db)):
    return UserService.get_user_by_id(db=db, user_id=user_id)

