#!/bin/bash
set -e

# Check if required commands are available
if ! command -v npx &> /dev/null; then
    echo "Error: npx is not installed. Please install Node.js which includes npx."
    echo "Visit https://nodejs.org/ to download and install Node.js"
    exit 1
fi

if ! command -v wget &> /dev/null; then
    echo "Error: wget is not installed. Please install wget:"
    echo "For macOS: brew install wget"
    echo "For Ubuntu/Debian: sudo apt-get install wget"
    echo "For CentOS/RHEL: sudo yum install wget"
    exit 1
fi

if ! command -v pandoc &> /dev/null; then
    echo "Error: pandoc is not installed. Please install pandoc:"
    echo "For macOS: brew install pandoc"
    echo "For Ubuntu/Debian: sudo apt-get install pandoc"
    echo "For CentOS/RHEL: sudo yum install pandoc"
    echo "For Windows: choco install pandoc"
    exit 1
fi

# Set the folder name without date
FOLDER_NAME="design-system/cdn-copy"

# Create the folder if it doesn't exist
mkdir -p "$FOLDER_NAME"

# Update config.json with new paths
echo "Updating config.json with new paths..."
CONFIG_FILE="config.json"
TMP_FILE="config.tmp.json"

# Use jq to update the paths without date
jq '.designSystem.cssPath = "/design-system/cdn-copy/plugins.css" | 
    .designSystem.jsPath = "/design-system/cdn-copy/plugins.js" |
    .designSystem.imagesPath = "/design-system/cdn-copy/images"' "$CONFIG_FILE" > "$TMP_FILE"

# Check if jq command was successful
if [ $? -eq 0 ]; then
    mv "$TMP_FILE" "$CONFIG_FILE"
    echo "✓ Successfully updated config.json"
else
    echo "✗ Failed to update config.json"
    rm -f "$TMP_FILE"
    exit 1
fi

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

# Extract and download images from plugins.css
echo "Downloading images referenced in plugins.css..."
cd "$FOLDER_NAME"
grep -o 'url([^)]*)' plugins.css | sed 's/url(//' | sed 's/)//' | sed 's/"//g' | sed "s/'//g" | while read -r url; do
    # Skip data URLs and fonts
    if [[ $url != data:* ]] && [[ $url != *".ttf"* ]] && [[ $url != *".woff"* ]]; then
        # Convert relative URLs to absolute
        if [[ $url != http* ]]; then
            url="https://usetrmnl.com$url"
        fi
        
        # Create directory structure if needed
        dir=$(dirname "$url" | sed 's|https://usetrmnl.com||')
        mkdir -p ".$dir"
        
        # Download the file
        echo "Downloading $url"
        curl -s -o ".$dir/$(basename "$url")" "$url"
    fi
done
cd ../..

# Download framework files
echo "Downloading framework doc files..."
FRAMEWORK_DIR="$FOLDER_NAME/framework"
mkdir -p "$FRAMEWORK_DIR"

wget --recursive \
     --no-clobber \
     --page-requisites \
     --html-extension \
     --convert-links \
     --domains usetrmnl.com \
     --no-parent \
     --directory-prefix="$FRAMEWORK_DIR" \
     "https://usetrmnl.com/framework/"

echo "✓ Successfully downloaded framework files"

# Convert HTML files to Markdown and delete original HTML files
find "$FRAMEWORK_DIR" -name "*.html" | while read -r html_file; do
    md_file="${html_file%.html}.md"
    pandoc "$html_file" -f html -t gfm -o "$md_file"
    echo "Converted $html_file to $md_file"
    rm "$html_file"
done

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
    echo "Downloading TRMNL font: $font... to $FONTS_DIR/$font"
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

# Create directories if they don't exist
mkdir -p /app/cdn/js
mkdir -p /app/cdn/css

# Download required files
# Add your wget or curl commands here to download the necessary files
# For example:
# wget -O /app/cdn/js/some-file.js https://example.com/some-file.js
