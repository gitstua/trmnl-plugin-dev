#!/bin/bash

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
    -p 4567:4567 \
    -v "$plugin_path:/plugin" \
    schrockwell/trmnlp 