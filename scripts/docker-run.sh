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
./scripts/docker-build.sh

echo "Running container for platform: $PLATFORM"

# Run the container with the correct platform
docker run --platform $PLATFORM \
    -p 3000:3000 \
    -v "$(pwd)/_plugins:/app/_plugins" \
    -v "$(pwd)/cache:/data/cache" \
    trmnl-plugin-tester:latest 