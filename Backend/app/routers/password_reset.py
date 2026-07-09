"""
Password Reset Flow
───────────────────
POST /auth/forgot-password  — validates email, creates a short-lived signed
                              token (15 min), emails a reset link.
POST /auth/reset-password   — validates token + new password, updates the
                              bcrypt hash, marks the token as used.

Security:
- Token is a JWT signed with SECRET_KEY with a dedicated 'purpose' claim.
- Generic response on /forgot-password prevents email enumeration.
- Tokens are single-use: stored in a bounded TTL cache until they expire.
- FRONTEND_URL is validated at startup; must start with http:// or https://.
"""

import os
import time
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from dotenv import load_dotenv

from app.utils.dependencies import get_db
from app.models.user import User
from app.utils.security import SECRET_KEY, ALGORITHM, hash_password
from app.utils.email_sender import _send_email
from app.utils.constants import RESET_TOKEN_EXPIRE_MINUTES
from app.utils.logger import auth_logger

load_dotenv()

router = APIRouter(prefix="/auth", tags=["Password Reset"])

# ── FRONTEND_URL validation ───────────────────────────────────────────────────
_raw_frontend_url = os.getenv("FRONTEND_URL", "").rstrip("/")
if not _raw_frontend_url:
    _raw_frontend_url = "http://localhost:5173"
    auth_logger.warning(
        "FRONTEND_URL not set in .env. Using default: http://localhost:5173"
    )
if not (_raw_frontend_url.startswith("http://") or _raw_frontend_url.startswith("https://")):
    raise RuntimeError(
        f"FRONTEND_URL must start with http:// or https://. Got: {_raw_frontend_url!r}"
    )
FRONTEND_URL: str = _raw_frontend_url

# ── Bounded used-token cache ──────────────────────────────────────────────────
# Maps token → expiry timestamp (epoch seconds).
# Prevents unbounded memory growth by pruning expired entries on each write.
_used_reset_tokens: dict[str, float] = {}


def _mark_token_used(token: str) -> None:
    """Record a token as used and prune any entries that have already expired."""
    now = time.time()
    expire_at = now + RESET_TOKEN_EXPIRE_MINUTES * 60
    _used_reset_tokens[token] = expire_at
    # Prune expired entries so the dict stays bounded
    expired = [t for t, exp in _used_reset_tokens.items() if exp <= now]
    for t in expired:
        del _used_reset_tokens[t]


def _is_token_used(token: str) -> bool:
    return token in _used_reset_tokens


# ── Schemas ───────────────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, description="Minimum 8 characters")


# ── Token helpers ─────────────────────────────────────────────────────────────

def _create_reset_token(email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": email, "purpose": "password_reset", "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_reset_token(token: str) -> Optional[str]:
    """Return the email from a valid reset token, or None if invalid/expired."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "password_reset":
            return None
        return payload.get("sub")
    except JWTError:
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Request a password reset link.
    Always returns the same generic message to prevent email enumeration.
    """
    user = db.query(User).filter(User.email == body.email).first()

    if user:
        token = _create_reset_token(user.email)
        reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
        subject_line = "QMS — Password Reset Request"
        body_text = (
            f"Hello {user.name},\n\n"
            "We received a request to reset the password for your QMS Hub account.\n\n"
            f"Click the link below to reset your password "
            f"(valid for {RESET_TOKEN_EXPIRE_MINUTES} minutes):\n\n"
            f"  {reset_link}\n\n"
            "If you did not request this, you can safely ignore this email.\n"
            "Your password will remain unchanged.\n\n"
            "Best regards,\nQMS Support Team"
        )
        import threading
        threading.Thread(
            target=_send_email,
            args=(user.email, subject_line, body_text),
            daemon=True,
        ).start()

    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Consume a reset token and update the user's password."""
    if _is_token_used(body.token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link has already been used. Please request a new one.",
        )

    email = _decode_reset_token(body.token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    user.password = hash_password(body.new_password)
    db.commit()
    _mark_token_used(body.token)

    return {"message": "Password updated successfully. You can now log in."}
