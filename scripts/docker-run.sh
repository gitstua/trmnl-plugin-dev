#!/bin/bash

# Check if port 3000 is in use and capture the details
port_info=$(netstat -an | grep LISTEN | grep 3000)

if [[ -n "$port_info" ]]; then
  echo "Error: Port 3000 is already in use. Details:"
  echo "$port_info"
  exit 1
fi

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

# Build the image using the shell script
echo "Building for platform: $PLATFORM"

# Build the image for the detected platform
# Check if no-cache parameter was passed
if [[ "$1" == "no-cache" ]]; then
    echo "Building with no-cache"
    docker build --platform $PLATFORM \
        --no-cache \
        -t trmnl-plugin-tester:latest \
        --build-arg BUILDPLATFORM=$PLATFORM .
else
    echo "Building with cache (add no-cache if you want to force a rebuild)"
    docker build --platform $PLATFORM \
        -t trmnl-plugin-tester:latest \
        --build-arg BUILDPLATFORM=$PLATFORM .
fi

# Run the container with the correct platform
echo "Running container for platform: $PLATFORM"

docker run --platform $PLATFORM \
    -p 3000:3000 \
    -v "$(pwd)/_plugins:/app/_plugins" \
    -v "$(pwd)/cache:/data/cache" \
    -e DEBUG_MODE=true \
    -e ENABLE_IMAGE_GENERATION=true \
    trmnl-plugin-tester:latest