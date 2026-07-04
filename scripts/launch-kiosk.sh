#!/usr/bin/env bash
set -euo pipefail

DESKOS_URL="${DESKOS_URL:-http://localhost:3000}"
CHROMIUM_PROFILE="/home/pi/.deskos-chromium"

# Detect Chromium binary (chromium-browser on Bullseye, chromium on Bookworm)
CHROMIUM_BIN=$(command -v chromium-browser || command -v chromium)
if [[ -z "$CHROMIUM_BIN" ]]; then
  echo "ERROR: Chromium not found. Install with: sudo apt install chromium-browser" >&2
  exit 1
fi

# Disable screen saver and power management
xset s off
xset s noblank
xset -dpms

"${CHROMIUM_BIN}" \
  --kiosk \
  --user-data-dir="${CHROMIUM_PROFILE}" \
  --no-first-run \
  --disable-default-apps \
  --disable-popup-blocking \
  --disable-translate \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  "${DESKOS_URL}"
