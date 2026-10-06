"""
Vercel Python Serverless Function entrypoint.

Vercel expects a file at api/index.py that exports a callable ASGI app.
This simply re-exports the FastAPI app from app.main.
"""
from app.main import app  # noqa: F401 — Vercel picks up `app` from this module
