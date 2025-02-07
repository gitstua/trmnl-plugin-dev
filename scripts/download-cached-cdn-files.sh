#!/bin/bash
set -e

# Check if required commands are available
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

# Set the folder name
FOLDER_NAME="design-system/cdn-copy"

# Create the folder if it doesn't exist
mkdir -p "$FOLDER_NAME"

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

echo "Done! Framework documentation files have been saved to $FRAMEWORK_DIR"
