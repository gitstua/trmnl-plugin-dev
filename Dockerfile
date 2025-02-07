FROM node:18-alpine

WORKDIR /app

# Install required dependencies
RUN apk add --no-cache \
    wget \
    curl \
    jq \
    bash

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Make sure the script is copied into the container and is executable
#COPY scripts/download-cached-cdn-files.sh /app/scripts/
#RUN chmod +x /app/scripts/download-cached-cdn-files.sh

# Then run the script
#RUN /app/scripts/download-cached-cdn-files.sh

# Expose the default port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 