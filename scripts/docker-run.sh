#!/bin/bash

# store the current directory
CURRENT_DIR=$(pwd)

# Ensure we're running from the project root for the build
cd "$(dirname "$0")/.."

# Set variables
IMAGE_NAME="gitstua/trmnl-plugin-tester"
VERSION=$(node -p "require('./package.json').version")

# Build the Docker image
echo "Building Docker image..."
docker build -t ${IMAGE_NAME}:${VERSION} .
docker tag ${IMAGE_NAME}:${VERSION} ${IMAGE_NAME}:latest

# change back to the current directory
cd "${CURRENT_DIR}"

# ensure $(pwd)/docker_cache exists
mkdir -p "$(pwd)/docker_cache"

# Function to cleanup Docker container on script exit
cleanup() {
    echo
    echo "Shutting down Docker container..."
    docker stop $(docker ps -q --filter ancestor=${IMAGE_NAME}:latest) 2>/dev/null
    exit
}

# Set up trap for cleanup
trap cleanup INT TERM

# Run the container with plugins directory mounted
echo "Running container..."
docker run -p 3000:3000 \
    --init \
    --rm \
    -v "$(pwd):/plugins" \
    -e PLUGINS_PATH="/plugins" \
    -v "$(pwd)/docker_cache:/data/cache" \
    -e CACHE_PATH="/data/cache" \
    -e DEBUG_MODE=true \
    -e USE_CACHE=false \
    ${IMAGE_NAME}:latest 