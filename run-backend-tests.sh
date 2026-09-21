#!/bin/bash
# Script to run backend tests in Docker with proper database setup

set -e

echo "Running backend tests..."
docker run --rm \
  --network cpi_replate_net \
  -e DATABASE_URL="postgresql+asyncpg://replate_user:replate_pass@replate_db:5432/replate_db" \
  -e DATABASE_URL_SYNC="postgresql://replate_user:replate_pass@replate_db:5432/replate_db" \
  -e REDIS_URL="redis://replate_redis:6379/0" \
  -e JWT_SECRET="test_secret_key_for_testing_only" \
  -e JWT_REFRESH_SECRET="test_refresh_secret_key_for_testing" \
  -v "$(pwd)/backend:/app" \
  -v "$(pwd)/tests:/app/tests" \
  -w /app \
  python:3.11-slim \
  bash -c "
    pip install --quiet poetry && \
    poetry config virtualenvs.create false && \
    poetry install --quiet && \
    pytest -v --tb=short
  "
