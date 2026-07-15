#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Bitte mit sudo ausführen: sudo bash deploy/install-pi.sh OWNER/REPO [benutzer]"
  exit 1
fi

REPOSITORY="${1:-}"
HOUSEOS_USER="${2:-${SUDO_USER:-}}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! "${REPOSITORY}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "GitHub-Repository im Format OWNER/REPO angeben."
  exit 1
fi
if [[ -z "${HOUSEOS_USER}" ]] || ! id "${HOUSEOS_USER}" >/dev/null 2>&1; then
  echo "Kiosk-Benutzer wurde nicht gefunden."
  exit 1
fi
if ! command -v node >/dev/null || [[ "$(node -p 'Number(process.versions.node.split(`.`)[0])')" -lt 20 ]]; then
  echo "HouseOS benötigt Node.js 20 oder neuer."
  exit 1
fi

apt-get update
apt-get install -y chromium cups curl rsync
install -d -o "${HOUSEOS_USER}" -g "${HOUSEOS_USER}" /opt/houseos /var/lib/houseos /var/tmp/houseos-update
rsync -a --delete --exclude node_modules --exclude data --exclude .git "${SOURCE_DIR}/" /opt/houseos/
cd /opt/houseos
npm ci
npm run build
npm prune --omit=dev
chown -R "${HOUSEOS_USER}:${HOUSEOS_USER}" /opt/houseos /var/lib/houseos /var/tmp/houseos-update

cat >/etc/houseos.env <<EOF
HOST=0.0.0.0
PORT=3001
HOUSEOS_HOME=/opt/houseos
HOUSEOS_DATA_DIR=/var/lib/houseos
HOUSEOS_UPDATE_DIR=/var/tmp/houseos-update
HOUSEOS_GITHUB_REPO=${REPOSITORY}
EOF
chmod 640 /etc/houseos.env

cp /opt/houseos/deploy/houseos-updater.service /etc/systemd/system/houseos-updater.service
SYSTEMCTL_PATH="$(command -v systemctl)"
cat >/etc/sudoers.d/houseos-updater <<EOF
${HOUSEOS_USER} ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} --no-block start houseos-updater.service
${HOUSEOS_USER} ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} reboot
${HOUSEOS_USER} ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} poweroff
EOF
chmod 440 /etc/sudoers.d/houseos-updater
visudo -cf /etc/sudoers.d/houseos-updater

bash /opt/houseos/deploy/optimize-kiosk-start.sh "${HOUSEOS_USER}"

if command -v raspi-config >/dev/null; then
  raspi-config nonint do_boot_behaviour B4
fi
systemctl enable --now cups.service houseos.service

echo "HouseOS ist eingerichtet. Nach 'sudo reboot' startet der Pi direkt im Kioskmodus."
