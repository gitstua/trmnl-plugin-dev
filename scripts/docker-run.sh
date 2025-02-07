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

# Run the container with plugins directory mounted
echo "Running container..."
docker run -p 3000:3000 \
    -v "$(pwd):/plugins" \
    -e PLUGINS_PATH="/plugins" \
    ${IMAGE_NAME}:latest 