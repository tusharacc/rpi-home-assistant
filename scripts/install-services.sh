#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKOS_USER="$(whoami)"
DESKOS_HOME="$HOME"

for unit in deskos-backend.service deskos-kiosk.service; do
  sed \
    -e "s|__DESKOS_USER__|${DESKOS_USER}|g" \
    -e "s|__DESKOS_REPO_DIR__|${REPO_DIR}|g" \
    -e "s|__DESKOS_HOME__|${DESKOS_HOME}|g" \
    "${REPO_DIR}/scripts/${unit}" | sudo tee "/etc/systemd/system/${unit}" > /dev/null
  echo "Installed /etc/systemd/system/${unit} (user=${DESKOS_USER}, dir=${REPO_DIR})"
done

sudo systemctl daemon-reload
sudo systemctl enable deskos-backend deskos-kiosk
echo "Services installed and enabled. Start with: sudo systemctl start deskos-backend"
