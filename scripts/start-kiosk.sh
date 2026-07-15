#!/usr/bin/env bash
set -u

HOUSEOS_URL="${HOUSEOS_URL:-http://127.0.0.1:3001}"
until curl --silent --fail "${HOUSEOS_URL}/api/health" >/dev/null; do
  sleep 2
done

while true; do
  chromium "${HOUSEOS_URL}" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --disable-session-crashed-bubble \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --start-maximized
  sleep 2
done
