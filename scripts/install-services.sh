#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKOS_USER="$(whoami)"
DESKOS_HOME="$HOME"

mkdir -p "${REPO_DIR}/packages/backend/data"

for unit in deskos-backend.service deskos-kiosk.service deskos-news-pipeline.service deskos-news-pipeline.timer; do
  sed \
    -e "s|__DESKOS_USER__|${DESKOS_USER}|g" \
    -e "s|__DESKOS_REPO_DIR__|${REPO_DIR}|g" \
    -e "s|__DESKOS_HOME__|${DESKOS_HOME}|g" \
    "${REPO_DIR}/scripts/${unit}" | sudo tee "/etc/systemd/system/${unit}" > /dev/null
  echo "Installed /etc/systemd/system/${unit} (user=${DESKOS_USER}, dir=${REPO_DIR})"
done

sudo systemctl daemon-reload
sudo systemctl enable deskos-backend deskos-kiosk
sudo systemctl enable --now deskos-news-pipeline.timer

# Scoped passwordless shutdown — restricted to exactly this one command,
# so the backend's "Shut Down" route can run it without a broad sudo grant.
SUDOERS_TMP="$(mktemp)"
sed "s|__DESKOS_USER__|${DESKOS_USER}|g" "${REPO_DIR}/scripts/deskos-shutdown.sudoers" > "${SUDOERS_TMP}"
sudo visudo -c -f "${SUDOERS_TMP}"
sudo install -o root -g root -m 0440 "${SUDOERS_TMP}" /etc/sudoers.d/deskos-shutdown
rm -f "${SUDOERS_TMP}"
echo "Installed /etc/sudoers.d/deskos-shutdown (user=${DESKOS_USER})"

# Scoped passwordless kiosk stop/start — restricted to exactly these two
# commands, so the backend's "Exit to Desktop" route and the desktop's
# "Return to DeskOS" launcher can run them without a broad sudo grant.
SUDOERS_TMP="$(mktemp)"
sed "s|__DESKOS_USER__|${DESKOS_USER}|g" "${REPO_DIR}/scripts/deskos-kiosk-control.sudoers" > "${SUDOERS_TMP}"
sudo visudo -c -f "${SUDOERS_TMP}"
sudo install -o root -g root -m 0440 "${SUDOERS_TMP}" /etc/sudoers.d/deskos-kiosk-control
rm -f "${SUDOERS_TMP}"
echo "Installed /etc/sudoers.d/deskos-kiosk-control (user=${DESKOS_USER})"

# Desktop icon so the kiosk can be relaunched with a mouse only, no keyboard
# needed to type a command after using "Exit to Desktop".
mkdir -p "${DESKOS_HOME}/Desktop"
sed "s|__DESKOS_REPO_DIR__|${REPO_DIR}|g" "${REPO_DIR}/scripts/deskos-return-to-kiosk.desktop" > "${DESKOS_HOME}/Desktop/deskos-return-to-kiosk.desktop"
chmod +x "${DESKOS_HOME}/Desktop/deskos-return-to-kiosk.desktop"
echo "Installed ${DESKOS_HOME}/Desktop/deskos-return-to-kiosk.desktop"

echo "Services installed and enabled. Start with: sudo systemctl start deskos-backend"
