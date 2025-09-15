#!/bin/sh
set -e

echo "[START] Starting BTC Tracker in production..."

# 1. Setup database (migrations + seed)
echo "[INFO] Setting up production database..."
node scripts/prod-setup.js

# 2. Start the Next.js application
echo "[WEB] Starting Next.js application..."
exec node server.js 