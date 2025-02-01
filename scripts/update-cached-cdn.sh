#!/bin/bash

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo "Error: npx is not installed. Please install Node.js which includes npx."
    echo "Visit https://nodejs.org/ to download and install Node.js"
    exit 1
fi

# Set the date for the folder name
DATE=$(date +%Y%m%d)
FOLDER_NAME="design-system/cdn-copy-$DATE"

# Create the folder if it doesn't exist
mkdir -p "$FOLDER_NAME"

# Create fonts directory
FONTS_DIR="$FOLDER_NAME/../fonts"
mkdir -p "$FONTS_DIR"

# Download the files
echo "Downloading latest CDN files to $FOLDER_NAME..."

# Download and format plugins.css
curl -s "https://usetrmnl.com/css/latest/plugins.css" | npx prettier --parser css > "$FOLDER_NAME/plugins.css"
if [ $? -eq 0 ]; then
    echo "✓ Successfully downloaded and formatted plugins.css"
else
    echo "✗ Failed to download/format plugins.css"
    exit 1
fi

# Download plugins.js
curl -s "https://usetrmnl.com/js/latest/plugins.js" | npx prettier --parser babel > "$FOLDER_NAME/plugins.js"
if [ $? -eq 0 ]; then
    echo "✓ Successfully downloaded and formatted plugins.js"
else
    echo "✗ Failed to download/format plugins.js"
    exit 1
fi

# Download fonts
echo "Downloading fonts..."

# TRMNL specific fonts
TRMNL_FONTS=(
    "BlockKie.ttf"
    "NicoBold-Regular.ttf"
    "NicoClean-Regular.ttf"
    "NicoPups-Regular.ttf"
)

for font in "${TRMNL_FONTS[@]}"; do
    echo "Downloading TRMNL font: $font..."
    curl -s "https://usetrmnl.com/fonts/$font" > "$FONTS_DIR/$font"
    if [ $? -eq 0 ]; then
        echo "✓ Successfully downloaded $font"
    else
        echo "✗ Failed to download $font from TRMNL CDN"
        exit 1
    fi
done

# Download Inter font from Google Fonts
echo "Downloading Inter font..."
curl -L -s "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" > "$FONTS_DIR/inter.css"
if [ $? -eq 0 ]; then
    echo "✓ Successfully downloaded Inter font CSS"
else
    echo "✗ Failed to download Inter font"
    exit 1
fi

echo "Done! Files have been saved to $FOLDER_NAME"
