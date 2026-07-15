#!/usr/bin/env bash
set -u

HOUSEOS_URL="${HOUSEOS_URL:-http://127.0.0.1:3001}"
HOUSEOS_DATA_DIR="${HOUSEOS_DATA_DIR:-/var/lib/houseos}"
EXIT_KIOSK_FILE="${HOUSEOS_DATA_DIR}/exit-kiosk"
rm -f "${EXIT_KIOSK_FILE}"
until curl --silent --fail "${HOUSEOS_URL}/api/health" >/dev/null; do
  sleep 0.1
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
  if [[ -f "${EXIT_KIOSK_FILE}" ]]; then
    rm -f "${EXIT_KIOSK_FILE}"
    exit 0
  fi
  sleep 2
done
