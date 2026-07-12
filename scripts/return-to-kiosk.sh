#!/usr/bin/env bash
set -euo pipefail

# Double-clicked from the RPi desktop (see deskos-return-to-kiosk.desktop) to
# relaunch DeskOS after "Exit to Desktop" or after reading an epaper. Kill any
# leftover Chromium window sharing the kiosk's --user-data-dir profile first
# (e.g. an epaper window left open) -- two Chromium processes pointed at the
# same profile fight over its lock, and the kiosk's relaunch can silently
# forward to the existing window instead of really starting kiosk mode.
pkill -u "$(whoami)" -f 'chromium.*--user-data-dir' 2>/dev/null || true
sleep 1

# Runs via the passwordless sudoers rule installed by install-services.sh
# (scripts/deskos-kiosk-control.sudoers), scoped to exactly this one command.
sudo /usr/bin/systemctl start deskos-kiosk.service
