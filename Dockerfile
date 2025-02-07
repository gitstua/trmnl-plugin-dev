FROM node:20-slim

WORKDIR /app

# Install required dependencies using apt-get (since we're using node:slim which is Debian-based)
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Create public directory
RUN mkdir -p /app/public

# Expose the default port
EXPOSE 3000

# Create build timestamp at the end to avoid caching
RUN date -u +'%Y-%m-%d %H:%M:%S UTC' > /app/public/build.txt && \
    echo "Build timestamp: $(cat /app/public/build.txt)"

# Start the application
CMD ["npm", "start"] 