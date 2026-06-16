from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from contextlib import asynccontextmanager
import threading
from app.utils.email_receiver import start_email_receiver

from app.database import engine, Base
import app.models  # Ensures models are registered
from app.routers import user, ticket, admin, message
from app.utils.websocket import manager

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
app.include_router(admin.router)
app.include_router(message.router)


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