#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Bitte als root ausführen."
  exit 1
fi

HOUSEOS_HOME="${HOUSEOS_HOME:-/opt/houseos}"
SERVICE_PATH="/etc/systemd/system/houseos.service"
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
install -d -o "${HOUSEOS_USER}" -g "${HOUSEOS_USER}" "${USER_HOME}/.config/labwc"
AUTOSTART="${USER_HOME}/.config/labwc/autostart"
touch "${AUTOSTART}"
sed -i '/start-kiosk\.sh/d' "${AUTOSTART}"
KIOSK_AUTOSTART="$(mktemp)"
{
  echo "${HOUSEOS_HOME}/scripts/start-kiosk.sh"
  cat "${AUTOSTART}"
} >"${KIOSK_AUTOSTART}"
install -o "${HOUSEOS_USER}" -g "${HOUSEOS_USER}" -m 644 "${KIOSK_AUTOSTART}" "${AUTOSTART}"
rm -f "${KIOSK_AUTOSTART}"

chmod +x "${HOUSEOS_HOME}/scripts/start-kiosk.sh"
systemctl daemon-reload
