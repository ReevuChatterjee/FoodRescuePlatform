"""
In-process WebSocket connection manager + broadcast helper.

Person 1 stands up this broker; Persons 2, 3, 5 (and 6) just subscribe/emit
through it per §2 of the contract — nobody else needs to touch this file.

For a single backend process this in-memory fan-out is sufficient. If the
service is ever horizontally scaled, swap the internals of broadcast() for a
Redis pub/sub relay without changing the public API (connect/disconnect/broadcast)
so callers never need to change.
"""
import json
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, channel: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[channel].add(websocket)

    def disconnect(self, channel: str, websocket: WebSocket) -> None:
        self._connections[channel].discard(websocket)

    async def broadcast(self, channel: str, event: dict) -> None:
        """Send `event` (JSON-serialized) to every socket subscribed to `channel`."""
        dead: list[WebSocket] = []
        for websocket in self._connections[channel]:
            try:
                await websocket.send_text(json.dumps(event, default=str))
            except Exception:
                dead.append(websocket)
        for websocket in dead:
            self._connections[channel].discard(websocket)


# Single shared instance imported by every router that needs to emit events.
manager = ConnectionManager()
