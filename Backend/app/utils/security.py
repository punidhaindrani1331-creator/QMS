import os
from datetime import datetime, timedelta
from typing import Optional

from dotenv import load_dotenv
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.utils.constants import UserRole, STAFF_ROLES, DEFAULT_TOKEN_EXPIRE_MINUTES
from app.utils.logger import auth_logger

load_dotenv()

# ── JWT configuration ─────────────────────────────────────────────────────────
_raw_secret = os.getenv("JWT_SECRET", "")
if not _raw_secret:
    raise RuntimeError(
        "JWT_SECRET environment variable is not set. "
        "Set a strong random secret in your .env file before starting the server."
    )
SECRET_KEY: str = _raw_secret
ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = DEFAULT_TOKEN_EXPIRE_MINUTES

# ── Password hashing ──────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plain-text password with bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a stored bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ── JWT helpers ───────────────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and verify a JWT token.
    Returns the payload dict on success, or None if the token is invalid/expired.
    """
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# ── FastAPI dependencies ──────────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Inject the current authenticated user's JWT payload."""
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload


def require_staff(current_user: dict = Depends(get_current_user)):
    """Allow Staff or Admin; reject everyone else with 403."""
    from app.database import SessionLocal
    from app.utils.auth_helpers import resolve_user_from_token

    db = SessionLocal()
    try:
        user = resolve_user_from_token(db, current_user)
        if user.role not in STAFF_ROLES:
            auth_logger.warning(f"Access denied for non-staff user: {user.email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Staff or Admin access required",
            )
        return user
    finally:
        db.close()


def require_admin(current_user: dict = Depends(get_current_user)):
    """Allow Admin only; reject everyone else with 403."""
    from app.database import SessionLocal
    from app.utils.auth_helpers import resolve_user_from_token

    db = SessionLocal()
    try:
        user = resolve_user_from_token(db, current_user)
        if user.role != UserRole.ADMIN:
            auth_logger.warning(f"Access denied for non-admin user: {user.email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required",
            )
        return user
    finally:
        db.close()


def require_staff_only(current_user: dict = Depends(get_current_user)):
    """Allow Staff only (not Admin, not Customer)."""
    from app.database import SessionLocal
    from app.utils.auth_helpers import resolve_user_from_token

    db = SessionLocal()
    try:
        user = resolve_user_from_token(db, current_user)
        if user.role != UserRole.STAFF:
            auth_logger.warning(f"Access denied for non-staff user: {user.email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Staff access required",
            )
        return user
    finally:
        db.close()
