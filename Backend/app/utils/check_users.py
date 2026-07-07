import sys; sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv(override=True)
from app.database import SessionLocal
from app.models.user import User
from app.utils.security import verify_password
db = SessionLocal()
users = db.query(User).all()
for u in users:
    print(f'id={u.id} | name={u.name} | email={u.email} | role={u.role}')
db.close()
