#!/bin/bash
set -e

# Browser Canvas Server Startup Script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Source config file if present (for Tailscale/code-server setup)
if [ -f "$SCRIPT_DIR/canvas.env" ]; then
  source "$SCRIPT_DIR/canvas.env"
fi

# Parse optional arguments
CANVAS_DIR=""
NO_BROWSER=""
BIND_HOST=""
CLIENT_HOST_ARG=""
PORT_ARG=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --dir)
      CANVAS_DIR="$2"
      shift 2
      ;;
    --no-browser)
      NO_BROWSER="1"
      shift
      ;;
    --host)
      BIND_HOST="$2"
      shift 2
      ;;
    --client-host)
      CLIENT_HOST_ARG="$2"
      shift 2
      ;;
    --port)
      PORT_ARG="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Disable auto-open browser if --no-browser flag or BROWSER=none
if [ -n "$NO_BROWSER" ]; then
  export BROWSER=none
fi

# Set host binding (default 127.0.0.1, use 0.0.0.0 for external access)
if [ -n "$BIND_HOST" ]; then
  export HOST="$BIND_HOST"
fi

# Set client-facing host (for WebSocket URLs when accessing remotely)
if [ -n "$CLIENT_HOST_ARG" ]; then
  export CLIENT_HOST="$CLIENT_HOST_ARG"
fi

# Set fixed port (for stable Tailscale serve config)
if [ -n "$PORT_ARG" ]; then
  export PORT="$PORT_ARG"
fi

# Default canvas dir if not specified
if [ -z "$CANVAS_DIR" ]; then
  CANVAS_DIR="$(pwd)/.claude/artifacts"
fi
export CANVAS_DIR

# Check if server is already running for this canvas directory
SERVER_JSON="$CANVAS_DIR/server.json"
if [ -f "$SERVER_JSON" ]; then
  PORT=$(grep -o '"port"[[:space:]]*:[[:space:]]*[0-9]*' "$SERVER_JSON" | grep -o '[0-9]*')
  if [ -n "$PORT" ]; then
    # Check if server is responding
    if curl -s --connect-timeout 1 "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
      echo "Browser Canvas server already running on port $PORT"
      echo "Canvas directory: $CANVAS_DIR"
      exit 0
    fi
  fi
fi

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  bun install
fi

# Ensure browser bundle is built
if [ ! -f "dist/canvas.js" ]; then
  echo "Building browser bundle..."
  bun run build
fi

# Start the server
echo "Starting Browser Canvas server..."
exec bun run start
