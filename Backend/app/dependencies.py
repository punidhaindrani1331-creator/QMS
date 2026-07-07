"""
Shared FastAPI dependencies used across multiple routers.

Centralising get_db here removes the identical copy-paste that existed in
every router module (user, ticket, admin, message, password_reset).
"""

from app.database import SessionLocal


def get_db():
    """Yield a SQLAlchemy session and ensure it is closed after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
