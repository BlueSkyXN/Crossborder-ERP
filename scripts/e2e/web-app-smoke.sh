#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$ROOT_DIR/.tmp/web-app-e2e"
LOG_DIR="$TMP_DIR/logs"
DB_PATH="$TMP_DIR/db.sqlite3"
MEDIA_ROOT="$TMP_DIR/media"
CHROME_PROFILE="$TMP_DIR/chrome-profile"
WEB_APP_PORT="${WEB_APP_PORT:-3000}"

PIDS=()

kill_tree() {
  local pid="$1"
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
  fi
}

cleanup() {
  local status=$?
  if [[ "$status" -ne 0 && -d "$LOG_DIR" ]]; then
    echo "[WEB-APP-SMOKE] smoke failed; service logs:" >&2
    find "$LOG_DIR" -maxdepth 1 -type f -print -exec sh -c 'echo "---- $1"; tail -n 120 "$1"' sh {} \; >&2 || true
  fi
  for pid in "${PIDS[@]:-}"; do
    kill_tree "$pid"
  done
  for pid in "${PIDS[@]:-}"; do
    wait "$pid" 2>/dev/null || true
  done
  rm -rf "$TMP_DIR" 2>/dev/null || {
    sleep 1
    rm -rf "$TMP_DIR" 2>/dev/null || true
  }
  exit "$status"
}

trap cleanup EXIT INT TERM

wait_url() {
  local name="$1"
  local url="$2"
  for _ in $(seq 1 90); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "[WEB-APP-SMOKE] ${name} did not become ready: ${url}" >&2
  find "$LOG_DIR" -type f -maxdepth 1 -print -exec sh -c 'echo "---- $1"; tail -n 80 "$1"' sh {} \; >&2 || true
  return 1
}

start_service() {
  local name="$1"
  shift
  echo "[WEB-APP-SMOKE] starting ${name}: $*"
  "$@" >"$LOG_DIR/${name}.log" 2>&1 &
  PIDS+=("$!")
}

rm -rf "$TMP_DIR"
mkdir -p "$LOG_DIR" "$MEDIA_ROOT" "$CHROME_PROFILE"

export DATABASE_URL="sqlite:///$DB_PATH"
export MEDIA_ROOT
export DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1,testserver"
export DJANGO_DISABLE_API_THROTTLE=true
export BROWSER_E2E_USER_DATA_DIR="$CHROME_PROFILE"
export BROWSER_E2E_TMP_DIR="$TMP_DIR"
export WEB_APP_URL="http://127.0.0.1:${WEB_APP_PORT}"

echo "[WEB-APP-SMOKE] using isolated SQLite: $DB_PATH"
echo "[WEB-APP-SMOKE] using isolated media: $MEDIA_ROOT"
echo "[WEB-APP-SMOKE] using isolated Chrome profile: $CHROME_PROFILE"
echo "[WEB-APP-SMOKE] using web app URL: $WEB_APP_URL"

(cd "$ROOT_DIR/backend" && uv run python manage.py migrate --noinput)
(cd "$ROOT_DIR/backend" && uv run python manage.py seed_demo)

start_service backend bash -lc "cd '$ROOT_DIR/backend' && uv run python manage.py runserver 127.0.0.1:8000"
start_service web-app bash -lc "cd '$ROOT_DIR' && pnpm --filter @crossborder-erp/web-app dev -- --host 127.0.0.1 --port '$WEB_APP_PORT'"

wait_url "backend" "http://127.0.0.1:8000/api/v1/health"
wait_url "web-app" "$WEB_APP_URL/login"

node "$ROOT_DIR/scripts/e2e/web-app-smoke.mjs"

echo "[WEB-APP-SMOKE] browser smoke passed"
