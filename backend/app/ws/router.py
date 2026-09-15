"""
WebSocket infra — the three broker channels Person 1 owns per §2:

  /ws/donations — donation.status_changed, donation.matched, donation.no_match_found
  /ws/deliveries — delivery.driver_assigned, delivery.location_update, delivery.status_changed
  /ws/drivers — driver.location_update, driver.status_changed

Browsers can't set custom headers on a WebSocket handshake, so auth is via
`?token=<jwt>` query param instead of the Authorization header used everywhere
else. Same JWT, same secret, same validation.

Persons 2/3/5 subscribe (read events); the REST routers in this codebase call
`manager.broadcast(channel, event)` to emit them — see donations/router.py and
drivers/router.py for examples.
"""
from typing import Annotated

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from app.core.config import settings
from app.ws.manager import manager

router = APIRouter(tags=["websocket"])


def _authenticate(token: str | None) -> str | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


async def _serve(websocket: WebSocket, channel: str, token: str | None) -> None:
    if _authenticate(token) is None:
        # A custom close code can only be delivered over an accepted
        # connection — closing before accept() has no WS handshake to carry
        # the code over, so ASGI servers just reject the upgrade with a
        # generic HTTP 403 and the 4401 is lost. Accept first, then close.
        # 4401 mirrors the REST 401 for unauthenticated access, using the
        # custom WS close-code range (4000-4999) reserved for application use.
        await websocket.accept()
        await websocket.close(code=4401)
        return

    await manager.connect(channel, websocket)
    try:
        while True:
            # Clients don't need to send anything; this just keeps the socket
            # open and lets us detect disconnects promptly.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(channel, websocket)


@router.websocket("/ws/donations")
async def ws_donations(websocket: WebSocket, token: Annotated[str | None, Query()] = None):
    await _serve(websocket, "donations", token)


@router.websocket("/ws/deliveries")
async def ws_deliveries(websocket: WebSocket, token: Annotated[str | None, Query()] = None):
    await _serve(websocket, "deliveries", token)


@router.websocket("/ws/drivers")
async def ws_drivers(websocket: WebSocket, token: Annotated[str | None, Query()] = None):
    await _serve(websocket, "drivers", token)
