#!/usr/bin/env bash
cd "$(dirname "$0")"
if [ -f .gateway.pid ]; then
  PID=$(cat .gateway.pid)
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "Gateway stopped (PID $PID)."
  else
    echo "Process $PID not running."
  fi
  rm -f .gateway.pid
else
  PORT=${PORT:-3333}
  PID=$(lsof -i ":$PORT" -sTCP:LISTEN -t 2>/dev/null)
  if [ -n "$PID" ]; then
    kill $PID 2>/dev/null
    echo "Gateway stopped (PID $PID)."
  else
    echo "No gateway process found on port $PORT."
  fi
fi
