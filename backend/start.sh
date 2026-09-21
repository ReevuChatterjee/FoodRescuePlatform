#!/bin/bash
# Free Tier Hack: Run both FastAPI and Celery in a single container

# Exit on error
set -e

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

# Start the Celery worker in the background
echo "Starting Celery worker in the background..."
celery -A app.worker worker --loglevel=info &

# Start the FastAPI web server in the foreground
echo "Starting FastAPI web server..."
uvicorn app.main:app --host 0.0.0.0 --port 8000
