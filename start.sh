#!/bin/bash

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Create data directory if it doesn't exist
mkdir -p src/data

# Start the application
echo "Starting BTC Tracker..."
node src/server.js 