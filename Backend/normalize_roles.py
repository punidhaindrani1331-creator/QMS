import sys; sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv(override=True)
from app.database import SessionLocal
from app.models.user import User
db = SessionLocal()
users = db.query(User).all()
for u in users:
    if u.role not in ('Staff',):
        u.role = 'Customer'
        print(f'Updated: {u.name} | {u.email} | role -> Customer')
    else:
        print(f'Kept:    {u.name} | {u.email} | role = {u.role}')
db.commit()
db.close()
