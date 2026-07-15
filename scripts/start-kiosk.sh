#!/usr/bin/env bash
set -u

HOUSEOS_URL="${HOUSEOS_URL:-http://127.0.0.1:3001}"
HOUSEOS_DATA_DIR="${HOUSEOS_DATA_DIR:-/var/lib/houseos}"
EXIT_KIOSK_FILE="${HOUSEOS_DATA_DIR}/exit-kiosk"
KIOSK_LOCK_FILE="${HOUSEOS_DATA_DIR}/kiosk.lock"
mkdir -p "${HOUSEOS_DATA_DIR}"
exec 9>"${KIOSK_LOCK_FILE}"
if ! flock -n 9; then
  exit 0
fi
rm -f "${EXIT_KIOSK_FILE}"
until curl --silent --fail "${HOUSEOS_URL}/api/health" >/dev/null; do
  sleep 0.5
done

while true; do
  if [[ -n "${XDG_RUNTIME_DIR:-}" && ( -z "${WAYLAND_DISPLAY:-}" || ! -S "${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}" ) ]]; then
    WAYLAND_SOCKET="$(find "${XDG_RUNTIME_DIR}" -maxdepth 1 -type s -name 'wayland-*' -print -quit 2>/dev/null || true)"
    if [[ -n "${WAYLAND_SOCKET}" ]]; then
      export WAYLAND_DISPLAY="$(basename "${WAYLAND_SOCKET}")"
    fi
  fi
  chromium "${HOUSEOS_URL}" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --disable-session-crashed-bubble \
    --disable-pinch \
    --touch-events=enabled \
    --overscroll-history-navigation=0 \
    --start-maximized
  if [[ -f "${EXIT_KIOSK_FILE}" ]]; then
    rm -f "${EXIT_KIOSK_FILE}"
    exit 0
  fi
  sleep 2
done
