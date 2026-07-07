"""
Application-wide constants and enumerations.

All business-domain string literals (roles, statuses, priorities, categories)
are defined here so they are never hardcoded across routers, services, or schemas.
Import from this module instead of using raw string values anywhere in the codebase.
"""

import os
from enum import Enum
from dotenv import load_dotenv

load_dotenv()


# ── User Roles ────────────────────────────────────────────────────────────────
class UserRole(str, Enum):
    ADMIN = "Admin"
    STAFF = "Staff"
    CUSTOMER = "Customer"


# ── Ticket Status ─────────────────────────────────────────────────────────────
class TicketStatus(str, Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"


# ── Ticket Priority ───────────────────────────────────────────────────────────
class TicketPriority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


# ── Ticket Category ───────────────────────────────────────────────────────────
class TicketCategory(str, Enum):
    REQUEST = "Request"
    BUG = "Bug"
    BILLING = "Billing"
    COMPLAINT = "Complaint"


# ── RBAC ───────────────────────────────────────────────────────────────────────
STAFF_ROLES: frozenset[str] = frozenset({UserRole.STAFF, UserRole.ADMIN})


# ── Ticket Queue Configuration ─────────────────────────────────────────────────
DEFAULT_WAIT_TIME_MINS: int = int(os.getenv("DEFAULT_WAIT_TIME_MINS", "12"))
DEFAULT_PRIORITY: str = os.getenv("DEFAULT_PRIORITY", TicketPriority.MEDIUM)


# ── Pagination ────────────────────────────────────────────────────────────────
DEFAULT_SKIP: int = 0
DEFAULT_LIMIT: int = 100
MAX_LIMIT: int = 1000


# ── Password Reset ────────────────────────────────────────────────────────────
RESET_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "15"))


# ── JWT Configuration ────────────────────────────────────────────────────────
DEFAULT_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


# ── Email Configuration ──────────────────────────────────────────────────────
IMAP_SOCKET_TIMEOUT: int = 60
IMAP_POLL_INTERVAL: int = 60
EMAIL_RETRY_ATTEMPTS: int = 3
EMAIL_RETRY_BACKOFF_BASE: int = 2
EMAIL_SMTP_TIMEOUT: int = 20


# ── Email Receiver Settings ─────────────────────────────────────────────────
EMAIL_BACKOFF_MIN: int = 10
EMAIL_BACKOFF_MAX: int = 320


# ── API Rate Limiting ───────────────────────────────────────────────────────
LOGIN_RATE_LIMIT_PER_MINUTE: int = 5


# ── CORS Configuration ────────────────────────────────────────────────────
DEFAULT_ALLOWED_ORIGINS: str = "http://localhost:5173"
