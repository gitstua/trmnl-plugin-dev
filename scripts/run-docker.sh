#!/bin/bash
# Ensure we're running from the project root
cd "$(dirname "$0")/.."

# Set variables
IMAGE_NAME="gitstua/trmnl-plugin-tester"
VERSION=$(node -p "require('./package.json').version")

# Build the Docker image
echo "Building Docker image..."
docker build -t ${IMAGE_NAME}:${VERSION} .
docker tag ${IMAGE_NAME}:${VERSION} ${IMAGE_NAME}:latest

# Run the container without the volume mount
echo "Running container..."
docker run -p 3000:3000 ${IMAGE_NAME}:latest 