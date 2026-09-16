#!/bin/bash

echo "🚀 Starting Food Rescue Platform servers..."

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: docker-compose could not be found. Please install it to run the servers."
    exit 1
fi

DOCKER_COMPOSE_CMD="docker-compose"

# Check if Docker daemon is running
if ! docker info > /dev/null 2>&1; then
    if sudo -n true 2>/dev/null && sudo docker info > /dev/null 2>&1 || sudo docker info > /dev/null 2>&1; then
        echo "⚠️  Docker requires sudo privileges. You may be prompted for your password."
        DOCKER_COMPOSE_CMD="sudo docker-compose"
    else
        echo "❌ Error: The Docker daemon is not running or accessible."
        echo "Please start Docker Desktop, or if on Linux, run 'sudo systemctl start docker' before running this script."
        exit 1
    fi
fi

echo "📦 Building and starting containers (backend, frontend, db, redis, worker)..."
$DOCKER_COMPOSE_CMD up -d --build

if [ $? -eq 0 ]; then
    echo "✅ Servers successfully started in the background!"
    echo "======================================================="
    echo "🌐 Frontend: http://localhost:5173"
    echo "🔌 Backend API: http://localhost:8000"
    echo "🩺 Backend Health: http://localhost:8000/health"
    echo "======================================================="
    echo "ℹ️  To view logs, run: $DOCKER_COMPOSE_CMD logs -f"
    echo "ℹ️  To stop servers, run: $DOCKER_COMPOSE_CMD down"
else
    echo "❌ Failed to start servers. Please check the docker-compose output above."
fi
