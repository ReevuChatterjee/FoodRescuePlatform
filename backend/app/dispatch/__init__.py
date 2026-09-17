"""Person 5 — dispatch: driver assignment, delivery lifecycle, driver job view.

Pure selection logic lives in selection.py (no DB); service.py owns the
database/WebSocket side; router.py exposes the driver-facing endpoints.
"""
