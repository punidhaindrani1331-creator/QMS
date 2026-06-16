from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin
from app.utils.security import hash_password, verify_password, create_access_token

class UserService:
    @staticmethod
    def create_user(db: Session, user_in: UserCreate) -> User:
        # Business Validation: Check if email already registered (returns 400 Bad Request)
        existing_user = db.query(User).filter(User.email == user_in.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Securely hash the password using bcrypt
        hashed_password = hash_password(user_in.password)
        
        # All new registrations default to Customer — Staff role is granted by an existing Staff member
        db_user = User(
            name=user_in.name,
            email=user_in.email,
            password=hashed_password,
            role='Customer'
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def create_staff(db: Session, user_in: UserCreate) -> User:
        """Admin-only: create a Staff account directly."""
        existing_user = db.query(User).filter(User.email == user_in.email).first()
        if existing_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        db_user = User(
            name=user_in.name,
            email=user_in.email,
            password=hash_password(user_in.password),
            role='Staff'
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def authenticate_user(db: Session, credentials: UserLogin) -> str:
        if "@" in credentials.username:
            user = db.query(User).filter(User.email == credentials.username).first()
        else:
            user = db.query(User).filter(User.name == credentials.username).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not verify_password(credentials.password, user.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return create_access_token(data={"sub": user.email, "user_id": user.id})

    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user

    @staticmethod
    def get_user_by_email(db: Session, email: str) -> User:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user

    @staticmethod
    def update_user_role(db: Session, user_id: int, new_role: str) -> User:
        VALID_ROLES = {'Customer', 'Staff', 'Admin'}
        if new_role not in VALID_ROLES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role must be one of: {VALID_ROLES}")
        user = UserService.get_user_by_id(db, user_id)
        user.role = new_role
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def get_users(db: Session, skip: int = 0, limit: int = 100):
        return db.query(User).offset(skip).limit(limit).all()

