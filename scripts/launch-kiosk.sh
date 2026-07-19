#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export DESKOS_URL="${DESKOS_URL:-http://localhost:3001}"

ELECTRON_BIN="${REPO_DIR}/node_modules/.bin/electron"
MAIN_JS="${REPO_DIR}/packages/electron/dist/main.js"

if [[ ! -x "$ELECTRON_BIN" ]]; then
  echo "ERROR: Electron not found at ${ELECTRON_BIN}. Run 'npm install' at the repo root." >&2
  exit 1
fi
if [[ ! -f "$MAIN_JS" ]]; then
  echo "ERROR: ${MAIN_JS} not found. Run 'npm run build' at the repo root." >&2
  exit 1
fi

# Disable screen saver and power management. X11/XWayland-level, independent
# of which browser/Electron process runs on top -- Electron reaches the
# display via XWayland exactly like Chromium did (see CLAUDE.md).
xset s off
xset s noblank
xset -dpms

exec "${ELECTRON_BIN}" "${MAIN_JS}"
