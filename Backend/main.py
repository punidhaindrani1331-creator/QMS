from fastapi import FastAPI
from contextlib import asynccontextmanager
import threading
from email_receiver import start_email_receiver

from app.database import engine, Base
import app.models  # Ensures models are registered
from app.routers import user, ticket

from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the email receiver in a daemon thread so it doesn't block the server
    receiver_thread = threading.Thread(target=start_email_receiver, daemon=True)
    receiver_thread.start()
    yield
    # Shutdown logic if needed

app = FastAPI(title="QMS API", lifespan=lifespan)

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