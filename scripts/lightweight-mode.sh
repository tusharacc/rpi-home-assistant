#!/usr/bin/env bash
set -euo pipefail

# One-time setup-time configuration — not run at every boot, not a runtime
# toggle. Run manually once during RPi setup, after ./install-services.sh.
# Leaves Wi-Fi untouched.

echo "Disabling Bluetooth..."
sudo rfkill block bluetooth

echo "Disabling unnecessary default desktop services..."
for svc in bluetooth avahi-daemon triggerhappy; do
  if systemctl list-unit-files | grep -q "^${svc}\.service"; then
    sudo systemctl disable --now "${svc}" || true
  fi
done

echo "Lightweight mode applied. Wi-Fi left enabled."
