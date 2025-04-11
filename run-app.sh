#!/bin/bash

# Colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   BTC Tracker - Easy Setup Script     ${NC}"
echo -e "${GREEN}========================================${NC}"
echo

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check for container engine (Docker or Podman)
if command_exists podman; then
  CONTAINER_ENGINE="podman"
  echo -e "${GREEN}✓${NC} Podman detected!"
elif command_exists docker; then
  CONTAINER_ENGINE="docker"
  echo -e "${GREEN}✓${NC} Docker detected!"
else
  echo -e "${RED}✗ Neither Docker nor Podman found!${NC}"
  echo -e "Please install either Docker or Podman to continue."
  exit 1
fi

# Check for docker-compose or podman-compose
if [ "$CONTAINER_ENGINE" = "docker" ] && command_exists docker-compose; then
  COMPOSE_ENGINE="docker-compose"
  echo -e "${GREEN}✓${NC} Docker Compose detected!"
elif [ "$CONTAINER_ENGINE" = "podman" ] && command_exists podman-compose; then
  COMPOSE_ENGINE="podman-compose"
  echo -e "${GREEN}✓${NC} Podman Compose detected!"
else
  COMPOSE_ENGINE=""
  if [ "$CONTAINER_ENGINE" = "podman" ]; then
    echo -e "${YELLOW}!${NC} Podman Compose not found. Will use native Podman commands."
  else
    echo -e "${YELLOW}!${NC} Docker Compose not found. Will use native Docker commands."
  fi
fi

# Ask user for port if they want to change it
echo
echo -e "What port would you like to run BTC Tracker on? (default: 3000)"
read -p "Port: " user_port
PORT=${user_port:-3000}

# Update .env file with user's port
echo -e "# Container Settings\nCONTAINER_NAME=btc-tracker\n\n# Port Settings\nPORT=$PORT\n\n# Path Settings\nDATA_PATH=./src/data\n\n# Environment Settings\nNODE_ENV=production" > .env

echo
echo -e "${GREEN}✓${NC} Created/updated .env file with port $PORT"

# Ensure data directory exists
mkdir -p src/data
echo -e "${GREEN}✓${NC} Ensured data directory exists"

# Run the application using the appropriate method
echo
echo -e "${YELLOW}Building and starting BTC Tracker...${NC}"

if [ "$COMPOSE_ENGINE" != "" ]; then
  # Using Docker/Podman Compose
  $COMPOSE_ENGINE build
  $COMPOSE_ENGINE up -d
  
  echo
  echo -e "${GREEN}✓${NC} BTC Tracker is now running!"
  echo -e "   Access it at: ${GREEN}http://localhost:$PORT${NC}"
  echo
  echo -e "${YELLOW}TIP:${NC} You can set a CoinGecko API key in the Admin Panel for better rate limits"
  
  echo
  echo -e "To stop the application, run: ${YELLOW}$COMPOSE_ENGINE down${NC}"
else
  # Using native Docker/Podman commands
  $CONTAINER_ENGINE build -t btc-tracker .
  
  # Stop and remove any existing container
  $CONTAINER_ENGINE stop btc-tracker 2>/dev/null
  $CONTAINER_ENGINE rm btc-tracker 2>/dev/null
  
  # Run the container
  $CONTAINER_ENGINE run -d --name btc-tracker -p $PORT:3000 -v ./src/data:/app/src/data btc-tracker
  
  echo
  echo -e "${GREEN}✓${NC} BTC Tracker is now running!"
  echo -e "   Access it at: ${GREEN}http://localhost:$PORT${NC}"
  echo
  echo -e "${YELLOW}TIP:${NC} You can set a CoinGecko API key in the Admin Panel for better rate limits"
  
  echo
  echo -e "To stop the application, run: ${YELLOW}$CONTAINER_ENGINE stop btc-tracker${NC}"
fi

echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Thank you for using BTC Tracker!      ${NC}"
echo -e "${GREEN}========================================${NC}" 