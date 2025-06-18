# Multi-arch compatible Dockerfile for Umbrel
FROM node:18-alpine

# Build arguments for multi-arch support
ARG BUILDPLATFORM
ARG TARGETPLATFORM
ARG TARGETOS
ARG TARGETARCH

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Create data directory with appropriate permissions
RUN mkdir -p src/data && chmod 777 src/data

# Create uploads directory if it doesn't exist
RUN mkdir -p src/uploads && chmod 777 src/uploads

# Expose the port the app runs on
EXPOSE 3000

# Set environment variable for path-manager.js
ENV DOCKER=true

# Command to run the application
CMD ["node", "src/server.js"] 