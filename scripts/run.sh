#!/bin/bash

# Check if port 3000 is in use and capture the details
port_info=$(netstat -an | grep LISTEN | grep 3000)

if [[ -n "$port_info" ]]; then
  echo "Error: Port 3000 is already in use. Details:"
  echo "$port_info"
  exit 1
fi

# Set debug mode
export DEBUG=true

# Store the original directory
ORIGINAL_DIR=$(pwd)

# Navigate to the project root
cd "$(dirname "$0")/.."

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "Node.js is not installed. Please install Node.js (version 14 or higher) and try again."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null
then
    echo "npm is not installed. Please install npm and try again."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Failed to install dependencies. Please check your internet connection and try again."
        exit 1
    fi
fi

# Start the development server with the original directory as PLUGINS_PATH
echo "Starting TRMNL Plugin Tester..."
echo "Access the tool at: http://localhost:3000"
PLUGINS_PATH="$ORIGINAL_DIR/_plugins" ADMIN_MODE=true npm run dev

# Start the server
node app.js 