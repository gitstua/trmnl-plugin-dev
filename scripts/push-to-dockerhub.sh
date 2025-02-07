#!/bin/bash

# Set variables
IMAGE_NAME="gitstua/trmnl-plugin-tester"
VERSION=$(node -p "require('./package.json').version")

# Build the Docker image
echo "Building Docker image..."
docker build -t ${IMAGE_NAME}:${VERSION} .
docker tag ${IMAGE_NAME}:${VERSION} ${IMAGE_NAME}:latest

# Push to Docker Hub
echo "Pushing to Docker Hub..."
docker push ${IMAGE_NAME}:${VERSION}
docker push ${IMAGE_NAME}:latest

echo "Done! Image pushed as ${IMAGE_NAME}:${VERSION} and ${IMAGE_NAME}:latest" 