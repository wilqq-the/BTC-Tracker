#!/bin/bash

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Create data directory if it doesn't exist
mkdir -p src/data

# Set default environment variables (can be overridden)
export NODE_ENV=${NODE_ENV:-production}
export COOKIE_MAX_AGE=${COOKIE_MAX_AGE:-86400000}  # 24 hours default for production

# Start the application
echo "Starting BTC Tracker..."
echo "Environment: $NODE_ENV"
echo "Cookie Max Age: $COOKIE_MAX_AGE ms ($(($COOKIE_MAX_AGE / 1000)) seconds)"
node src/server.js 