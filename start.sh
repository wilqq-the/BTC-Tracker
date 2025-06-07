#!/bin/bash

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Create data directory if it doesn't exist
mkdir -p src/data

# Debug mode configuration
DEBUG_MODE=${1:-"normal"}

case $DEBUG_MODE in
  "currency"|"rates"|"yahoo")
    echo "🔍 CURRENCY DEBUG MODE ENABLED"
    export NODE_ENV=${NODE_ENV:-development}
    export COOKIE_MAX_AGE=${COOKIE_MAX_AGE:-300000}
    export LOG_LEVEL=debug
    export DEBUG_CURRENCY=true
    export DEBUG_YAHOO_API=true
    export DEBUG_EXCHANGE_RATES=true
    echo "📊 Currency fetching debug enabled"
    echo "🌐 Yahoo Finance API calls will be logged"
    echo "💱 Exchange rate calculations will be detailed"
    ;;
  "verbose"|"full")
    echo "🔍 FULL DEBUG MODE ENABLED"
    export NODE_ENV=${NODE_ENV:-development}
    export COOKIE_MAX_AGE=${COOKIE_MAX_AGE:-300000}
    export LOG_LEVEL=debug
    export DEBUG=*
    export DEBUG_CURRENCY=true
    export DEBUG_YAHOO_API=true
    export DEBUG_EXCHANGE_RATES=true
    export DEBUG_CACHE=true
    echo "📊 All debug logging enabled"
    ;;
  "quiet")
    echo "🔇 QUIET MODE"
    export NODE_ENV=${NODE_ENV:-production}
    export COOKIE_MAX_AGE=${COOKIE_MAX_AGE:-86400000}
    export LOG_LEVEL=warn
    ;;
  *)
    echo "🚀 NORMAL MODE"
    export NODE_ENV=${NODE_ENV:-development}
    export COOKIE_MAX_AGE=${COOKIE_MAX_AGE:-300000}
    export LOG_LEVEL=${LOG_LEVEL:-info}
    ;;
esac

# Start the application
echo ""
echo "Starting BTC Tracker..."
echo "Mode: $DEBUG_MODE"
echo "Environment: $NODE_ENV"
echo "Cookie Max Age: $COOKIE_MAX_AGE ms ($(($COOKIE_MAX_AGE / 1000)) seconds)"
echo "Log Level: $LOG_LEVEL"

if [ "$DEBUG_CURRENCY" = "true" ]; then
  echo ""
  echo "🔍 DEBUG FEATURES ENABLED:"
  echo "  📊 Currency fetching details"
  echo "  🌐 Yahoo Finance API request/response logging"
  echo "  💱 Exchange rate calculation tracing"
  echo "  📈 Rate validation and fallback logging"
  echo ""
  echo "📋 Usage examples:"
  echo "  - Watch logs: tail -f logs/app.log | grep -E '(priceCache|CURRENCY|Yahoo)'"
  echo "  - Debug in browser: debugCurrencyRates()"
  echo "  - Force fresh rates: curl 'http://localhost:3000/api/summary?priceOnly=true&fresh=true'"
  echo ""
fi

node src/server.js 