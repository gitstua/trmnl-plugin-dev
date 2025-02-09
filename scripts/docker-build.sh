#!/bin/bash

# Determine the host architecture
ARCH=$(uname -m)
case $ARCH in
    arm64|aarch64)
        PLATFORM="linux/arm64"
        ;;
    x86_64|amd64)
        PLATFORM="linux/amd64"
        ;;
    *)
        echo "Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

echo "Building for platform: $PLATFORM"

# Build the image for the detected platform
docker build --platform $PLATFORM \
    --no-cache \
    -t trmnl-plugin-tester:latest \
    --build-arg BUILDPLATFORM=$PLATFORM \
    .

echo "Build complete. To run the container:"
echo "docker run --platform $PLATFORM -p 3000:3000 trmnl-plugin-tester:latest" 