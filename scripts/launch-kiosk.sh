#!/usr/bin/env bash
set -euo pipefail

DESKOS_URL="${DESKOS_URL:-http://localhost:3001}"
CHROMIUM_PROFILE="${CHROMIUM_PROFILE:-$HOME/.deskos-chromium}"

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

# Chrome defaults cookies without an explicit SameSite attribute to Lax,
# which is sent on direct top-level navigation but withheld on cross-site
# iframe loads -- exactly the epaper.thehindu.com case here (embedded from
# this app's own origin). That silently drops the subscription-entitlement
# cookie in the kiosk even after signing in directly in a standalone
# Chromium window, so it can show "subscribed" there and "unsubscribed"
# here. Reverting to legacy behavior (no-SameSite-attribute == None) lets
# that cookie flow through the iframe. Acceptable on a single-purpose
# personal kiosk, same tradeoff as --disable-web-security above.
"${CHROMIUM_BIN}" \
  --kiosk \
  --disable-web-security \
  --disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure \
  --user-data-dir="${CHROMIUM_PROFILE}" \
  --no-first-run \
  --disable-default-apps \
  --disable-popup-blocking \
  --disable-translate \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  "${DESKOS_URL}"
