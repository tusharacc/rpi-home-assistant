#!/usr/bin/env bash
set -euo pipefail

# Args: the-hindu | livemint
#
# Called from deskos-backend.service after it stops deskos-kiosk.service, to
# open an epaper as its own top-level Chromium window sharing the kiosk's
# profile. Epaper sessions are localStorage-based, not cookie-based, and
# Chromium's storage partitioning gives a third-party iframe (which is what
# DeskOS used previously) a totally separate, permanently-empty localStorage
# from the top-level site -- so an iframe can never see a real login no
# matter how many times the user signs in. Only a genuine top-level
# navigation shares the same storage partition as a direct sign-in.
#
# Unlike deskos-kiosk.service, deskos-backend.service does not set
# DISPLAY/XAUTHORITY, so derive them the same way the kiosk unit hardcodes
# them.
export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"

CHROMIUM_PROFILE="${CHROMIUM_PROFILE:-$HOME/.deskos-chromium}"
CHROMIUM_BIN=$(command -v chromium-browser || command -v chromium)
if [[ -z "$CHROMIUM_BIN" ]]; then
  echo "ERROR: Chromium not found." >&2
  exit 1
fi

SITE="${1:-}"
case "$SITE" in
  the-hindu) URL="https://epaper.thehindu.com" ;;
  livemint)  URL="https://epaper.livemint.com" ;;
  *)
    echo "ERROR: usage: $0 the-hindu|livemint" >&2
    exit 1
    ;;
esac

"${CHROMIUM_BIN}" \
  --user-data-dir="${CHROMIUM_PROFILE}" \
  --no-first-run \
  --disable-default-apps \
  "${URL}" &
disown
