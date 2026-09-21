#!/bin/bash
# Free Tier Hack: Run both FastAPI and Celery in a single container

# Exit on error
set -e

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

# Seed default admin user (safe to run multiple times)
echo "Seeding default admin user..."
python -m app.scripts.seed_admin --email "admin@replate.org" --password "ChangeMe123!" --name "Main Admin"

# Start the FastAPI web server in the foreground
echo "Starting FastAPI web server..."
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
