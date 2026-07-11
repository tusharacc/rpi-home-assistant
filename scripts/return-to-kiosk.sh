#!/usr/bin/env bash
set -euo pipefail

# Double-clicked from the RPi desktop (see deskos-return-to-kiosk.desktop) to
# relaunch DeskOS after "Exit to Desktop". Runs via the passwordless sudoers
# rule installed by install-services.sh (scripts/deskos-kiosk-control.sudoers),
# scoped to exactly this one command.
sudo /usr/bin/systemctl start deskos-kiosk.service
