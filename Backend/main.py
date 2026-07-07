from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from contextlib import asynccontextmanager
import os
import threading
from dotenv import load_dotenv

from app.utils.email_receiver import start_email_receiver
from app.database import engine, Base
import app.models
from app.routers import user, ticket, admin, message
from app.routers import password_reset
from app.utils.websocket import manager
from app.utils.logger import logger
from app.constants import DEFAULT_ALLOWED_ORIGINS

from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting QMS API server")
    # Start the email receiver in a daemon thread so it doesn't block the server
    receiver_thread = threading.Thread(target=start_email_receiver, daemon=True)
    receiver_thread.start()
    yield
    logger.info("Shutting down QMS API server")

app = FastAPI(title="QMS API", lifespan=lifespan)

# Enable CORS for frontend requests
allowed_origins = os.getenv("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS).split(",")
logger.info(f"CORS configured for origins: {allowed_origins}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

Base.metadata.create_all(bind=engine)

# Dynamic DB Schema update to add missing columns
from sqlalchemy import inspect, text
inspector = inspect(engine)
if 'users' in inspector.get_table_names():
    existing_columns = [col['name'] for col in inspector.get_columns('users')]
    with engine.begin() as conn:
        if 'phone_number' not in existing_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) NULL"))
        if 'department' not in existing_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN department VARCHAR(100) NULL"))

app.include_router(user.router)
app.include_router(ticket.router)
app.include_router(admin.router)
app.include_router(message.router)
app.include_router(password_reset.router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Listen to keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/")
def home():
    return {"message": "QMS API Running"}
