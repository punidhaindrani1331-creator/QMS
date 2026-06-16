import sys; sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv(override=True)
from app.database import SessionLocal
from app.models.user import User

db = SessionLocal()

# Update jeevi (id=1) to Staff role
user = db.query(User).filter(User.id == 1).first()
user.role = 'Staff'
db.commit()
print(f'Updated: {user.name} | role={user.role}')

db.close()
