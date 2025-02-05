#!/bin/bash

# What does this script do?
# 1. Find all directories containing config.toml
# 2. Display a menu of plugins
# 3. Get user selection
# 4. Serve the selected plugin using trmnlp if it exists, otherwise use Docker

# Find all directories containing config.toml
plugins=()
while IFS= read -r dir; do
    plugins+=("$(basename "$(dirname "$dir")")")
done < <(find . -name "config.toml" -type f)

# Exit if no plugins found
if [ ${#plugins[@]} -eq 0 ]; then
    echo "No plugins found (no config.toml files in subdirectories)"
    exit 1
fi

# Display menu
echo "Available plugins:"
for i in "${!plugins[@]}"; do
    echo "$((i+1)). ${plugins[$i]}"
done

# Get user selection
echo
echo -n "Select plugin (1-${#plugins[@]}): "
read selection

# Validate input
if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt "${#plugins[@]}" ]; then
    echo "Invalid selection"
    exit 1
fi

# Get selected plugin
selected_plugin="${plugins[$((selection-1))]}"
plugin_path="$(pwd)/$selected_plugin"

# Check if rbenv trmnlp exists
TRMNLP_PATH="/Users/$(whoami)/.rbenv/shims/trmnlp"

if [ -f "$TRMNLP_PATH" ]; then
    # Use rbenv version if it exists
    echo "Using local trmnlp installation..."
    "$TRMNLP_PATH" serve "$plugin_path"
else
    # Fallback to Docker
    echo "Local trmnlp not found, using Docker..."
    
    # Function to cleanup Docker container on script exit
    cleanup() {
        echo
        echo "Shutting down Docker container..."
        docker stop trmnlp 2>/dev/null
        docker rm trmnlp 2>/dev/null
        exit
    }

    # Set up trap for cleanup
    trap cleanup INT TERM

    echo "Starting plugin: $selected_plugin"
    echo "Plugin path: $plugin_path"
    echo
    echo "Docker command that will be executed:"
    echo "docker run \\"
    echo "    -p 4567:4567 \\"
    echo "    -v \"$plugin_path:/plugin\" \\"
    echo "    schrockwell/trmnlp"
    echo
    echo "Press Enter to execute, Ctrl+C to cancel"
    read

    # Run docker
    docker run \
        --name trmnlp \
        -p 4567:4567 \
        -v "$plugin_path:/plugin" \
        schrockwell/trmnlp

    # Clean up container after exit
    cleanup
fi 