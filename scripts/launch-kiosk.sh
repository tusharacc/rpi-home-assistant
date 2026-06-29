#!/usr/bin/env bash
set -euo pipefail

DESKOS_URL="${DESKOS_URL:-http://localhost:3000}"
CHROMIUM_PROFILE="/home/pi/.deskos-chromium"

# Disable screen saver and power management
xset s off
xset s noblank
xset -dpms

chromium-browser \
  --kiosk \
  --disable-web-security \
  --user-data-dir="${CHROMIUM_PROFILE}" \
  --no-first-run \
  --disable-default-apps \
  --disable-popup-blocking \
  --disable-translate \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  "${DESKOS_URL}"
