#!/usr/bin/env bash
# testgreenapi — управление dev-сервером (vite, 127.0.0.1:5216).
# Usage: ./ctl.sh start|stop|restart|status|logs
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAR_DIR="$ROOT/var"; mkdir -p "$VAR_DIR"
PID="$VAR_DIR/vite.pid"
LOG="$VAR_DIR/vite.log"
PORT=5216

is_running() { [[ -f "$PID" ]] && kill -0 "$(cat "$PID")" 2>/dev/null; }

start() {
  if is_running; then echo "✓ уже запущен (pid $(cat "$PID")) → http://127.0.0.1:$PORT"; return; fi
  [[ -d "$ROOT/node_modules" ]] || (cd "$ROOT" && npm install)
  (cd "$ROOT" && nohup npx vite > "$LOG" 2>&1 & echo $! > "$PID")
  for _ in $(seq 1 30); do
    curl -sf "http://127.0.0.1:$PORT" >/dev/null && { echo "✓ запущен → http://127.0.0.1:$PORT (testgreenapi.localhost)"; return; }
    sleep 0.5
  done
  echo "✗ не поднялся, см. $LOG" >&2; return 1
}

stop() {
  if is_running; then
    pkill -P "$(cat "$PID")" 2>/dev/null || true
    kill "$(cat "$PID")" 2>/dev/null || true
    echo "✓ остановлен"
  else
    echo "· не запущен"
  fi
  rm -f "$PID"
}

status() {
  if is_running; then echo "✓ running (pid $(cat "$PID")) :$PORT"; else echo "· stopped"; return 3; fi
}

case "${1:-help}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  logs) tail -n 100 -f "$LOG" ;;
  *) echo "Usage: $0 start|stop|restart|status|logs"; exit 1 ;;
esac
