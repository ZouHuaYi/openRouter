#!/usr/bin/env bash
cd "$(dirname "$0")"
PORT=${PORT:-3333}
if lsof -i ":$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Port $PORT already in use. Gateway may be running."
  exit 1
fi
echo "Starting gateway at http://localhost:$PORT ..."
npm start &
echo $! > .gateway.pid
echo "Gateway started (PID $(cat .gateway.pid)). Use ./stop.sh to stop."
