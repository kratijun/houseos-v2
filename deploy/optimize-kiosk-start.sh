#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Bitte als root ausführen."
  exit 1
fi

HOUSEOS_HOME="${HOUSEOS_HOME:-/opt/houseos}"
SERVICE_PATH="/etc/systemd/system/houseos.service"
KIOSK_SERVICE_PATH="/etc/systemd/system/houseos-kiosk.service"
HOUSEOS_USER="${1:-}"

if [[ -z "${HOUSEOS_USER}" && -f "${SERVICE_PATH}" ]]; then
  HOUSEOS_USER="$(sed -n 's/^User=//p' "${SERVICE_PATH}" | head -n 1)"
fi
if [[ -z "${HOUSEOS_USER}" ]] || ! id "${HOUSEOS_USER}" >/dev/null 2>&1; then
  echo "Kiosk-Benutzer wurde nicht gefunden."
  exit 1
fi

SERVICE_TMP="$(mktemp)"
sed "s/@HOUSEOS_USER@/${HOUSEOS_USER}/g" "${HOUSEOS_HOME}/deploy/houseos.service" >"${SERVICE_TMP}"
install -m 644 "${SERVICE_TMP}" "${SERVICE_PATH}"
rm -f "${SERVICE_TMP}"

USER_HOME="$(getent passwd "${HOUSEOS_USER}" | cut -d: -f6)"
USER_UID="$(id -u "${HOUSEOS_USER}")"
install -d -o "${HOUSEOS_USER}" -g "${HOUSEOS_USER}" "${USER_HOME}/.config/labwc"
AUTOSTART="${USER_HOME}/.config/labwc/autostart"
touch "${AUTOSTART}"
sed -i '/start-kiosk\.sh/d' "${AUTOSTART}"

KIOSK_SERVICE_TMP="$(mktemp)"
sed \
  -e "s|@HOUSEOS_USER@|${HOUSEOS_USER}|g" \
  -e "s|@HOUSEOS_UID@|${USER_UID}|g" \
  -e "s|@HOUSEOS_USER_HOME@|${USER_HOME}|g" \
  "${HOUSEOS_HOME}/deploy/houseos-kiosk.service" >"${KIOSK_SERVICE_TMP}"
install -m 644 "${KIOSK_SERVICE_TMP}" "${KIOSK_SERVICE_PATH}"
rm -f "${KIOSK_SERVICE_TMP}"

chmod +x "${HOUSEOS_HOME}/scripts/start-kiosk.sh"
systemctl daemon-reload
systemctl enable houseos-kiosk.service

if [[ "${HOUSEOS_DEFER_KIOSK_RESTART:-0}" != "1" ]]; then
  systemctl stop houseos-kiosk.service 2>/dev/null || true
  pkill -TERM -u "${HOUSEOS_USER}" -f 'chromium.*--kiosk' 2>/dev/null || true
  pkill -TERM -u "${HOUSEOS_USER}" -f "${HOUSEOS_HOME}/scripts/start-kiosk.sh" 2>/dev/null || true
  sleep 1
  systemctl start houseos-kiosk.service
fi
