FROM node:20-slim

WORKDIR /app

# Create build timestamp at build time
RUN mkdir -p /app/public && date -u +'%Y-%m-%d %H:%M:%S UTC' > /app/public/build.txt

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

# Expose the default port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 