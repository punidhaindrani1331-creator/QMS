from fastapi import FastAPI
from app.database import engine, Base
import app.models  # Ensures models are registered
from app.routers import user, ticket

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="QMS API")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins, change to frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(user.router)
app.include_router(ticket.router)

@app.get("/")
def home():
    return {"message": "QMS API Running"}