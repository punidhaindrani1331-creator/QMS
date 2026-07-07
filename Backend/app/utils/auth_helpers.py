"""
Shared authentication helpers used across routers.

Centralizes JWT payload resolution and user lookup to prevent duplication and N+1 queries.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.utils.logger import auth_logger


def resolve_user_from_token(db: Session, token_payload: dict) -> User:
    """
    Resolve the full User ORM object from a JWT token payload.

    Args:
        db: Database session
        token_payload: JWT payload dict with 'sub' claim (email)

    Returns:
        User ORM object

    Raises:
        HTTPException (401): If user no longer exists
    """
    email = token_payload.get("sub")
    if not email:
        auth_logger.warning("Token payload missing 'sub' claim")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        auth_logger.warning(f"User account no longer exists: {email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found",
        )

    return user
