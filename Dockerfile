FROM node:18-alpine

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

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "src/server.js"] 