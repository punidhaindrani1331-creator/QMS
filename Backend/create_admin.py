"""
Run once to create the first Admin account:
    python create_admin.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
import app.models  # registers all models
from app.models.user import User
from app.utils.security import hash_password

Base.metadata.create_all(bind=engine)

ADMIN_NAME     = "admin"
ADMIN_EMAIL    = "admin@qms.com"
ADMIN_PASSWORD = "Admin@1234"   # change before production

db = SessionLocal()
try:
    existing = db.query(User).filter(User.email == ADMIN_EMAIL).first()
    if existing:
        print(f"[SKIP] Admin already exists: {ADMIN_EMAIL}")
    else:
        admin = User(
            name=ADMIN_NAME,
            email=ADMIN_EMAIL,
            password=hash_password(ADMIN_PASSWORD),
            role="Admin"
        )
        db.add(admin)
        db.commit()
        print(f"[OK] Admin created — email: {ADMIN_EMAIL}  password: {ADMIN_PASSWORD}")
        print("     Change the password after first login!")
finally:
    db.close()
