#!/bin/bash

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Create data directory if it doesn't exist
mkdir -p src/data

# Set default environment variables for local development
export NODE_ENV=${NODE_ENV:-development}
export COOKIE_MAX_AGE=${COOKIE_MAX_AGE:-300000}  # 5 minutes default for development
export LOG_LEVEL=${LOG_LEVEL:-debug}

# Start the application
echo "Starting BTC Tracker..."
echo "Environment: $NODE_ENV"
echo "Cookie Max Age: $COOKIE_MAX_AGE ms ($(($COOKIE_MAX_AGE / 1000)) seconds)"
echo "Log Level: $LOG_LEVEL"
node src/server.js 