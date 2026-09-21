#!/bin/bash
# Free Tier Hack: Run both FastAPI and Celery in a single container

# Exit on error
set -e

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

# Start the FastAPI web server in the foreground
echo "Starting FastAPI web server..."
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
