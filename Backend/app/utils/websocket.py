from fastapi import WebSocket
import asyncio
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"[WS] Client connected. Total active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"[WS] Client disconnected. Total active connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        # Create a copy to prevent mutation during iteration
        connections = list(self.active_connections)
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"[WS] Failed to send message to client, disconnecting: {e}")
                self.disconnect(connection)

manager = ConnectionManager()

def broadcast_event(event_type: str, data: dict):
    """
    Schedules a websocket broadcast task in the running event loop.
    Safe to call from synchronous code.
    """
    event = {
        "type": event_type,
        "data": data
    }
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast(event))
        print(f"[WS BROADCAST] Scheduled event '{event_type}'")
    except RuntimeError:
        # If there's no running event loop (e.g. running scripts), fallback
        try:
            asyncio.run(manager.broadcast(event))
        except Exception as ex:
            print(f"[WS BROADCAST WARNING] Could not broadcast: {ex}")
    except Exception as e:
        print(f"[WS BROADCAST ERROR] {e}")
