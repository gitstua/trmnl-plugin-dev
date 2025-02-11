# Use Alpine for a lightweight, multi-arch base image
FROM --platform=$BUILDPLATFORM node:18-alpine3.15 AS base

#Note latest alpine does not have a imagemagick6 package
#FROM --platform=$BUILDPLATFORM node:18-alpine AS base

# write the platform to the log
RUN echo "BUILDPLATFORM: $BUILDPLATFORM"

# Install necessary packages
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    imagemagick6

# NOTE: ImageMagick6 is required for the plugin to work as 7 creates 1.2MB 
# files that cannot be displayed on the TRMNL screen. (maybe timeout downloading
# or maybe too large)

# Set environment variables for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=production

# Set up working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the application
COPY . .

# Create cache directory and public directory
RUN mkdir -p /data/cache /app/public /tmp

# Expose the default port
EXPOSE 3000

# Build timestamp
RUN date -u +'%Y-%m-%d %H:%M:%S UTC' > /app/public/build.txt

# Set environment variables
ENV CACHE_PATH=/data/cache
ENV USE_CACHE=false
ENV DEBUG_MODE=false
ENV MAX_REQUESTS_PER_5_MIN=400

# Disable image generation in Docker by default
ENV ENABLE_IMAGE_GENERATION=false

# Persistent cache volume
VOLUME /data/cache

# Start the application
CMD ["npm", "start"]