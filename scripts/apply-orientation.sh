#!/usr/bin/env bash
set -euo pipefail

# Args: portrait | landscape | (none — reads the persisted setting)
# Rotates the whole kiosk output via the Wayland compositor's output-transform
# tooling. TODO(architect open question): confirm labwc vs wayfire on the
# deployed Pi — this currently assumes wlr-randr (labwc).
#
# Called two ways: with an explicit arg from the backend's
# POST /api/settings/rotate route, and with no arg from deskos-kiosk.service's
# ExecStartPre (before the backend is necessarily up), in which case it reads
# the persisted value directly off disk.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETTINGS_FILE="${SCRIPT_DIR}/../packages/backend/data/settings.json"

# systemd's ExecStartPre doesn't inherit the graphical session's environment,
# so wlr-randr (a native Wayland client, unlike Chromium which runs under
# XWayland via DISPLAY=:0) needs these discovered explicitly rather than
# assumed set — same class of issue as the earlier X11 DISPLAY/XAUTHORITY
# problem, for the Wayland side this time.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if [[ -z "${WAYLAND_DISPLAY:-}" ]]; then
  export WAYLAND_DISPLAY="$(ls -1 "${XDG_RUNTIME_DIR}" 2>/dev/null | grep -E '^wayland-[0-9]+$' | head -n1)"
fi
if [[ -z "${WAYLAND_DISPLAY:-}" ]]; then
  echo "ERROR: no Wayland display socket found in ${XDG_RUNTIME_DIR}" >&2
  exit 1
fi

ORIENTATION="${1:-}"
if [[ -z "$ORIENTATION" ]]; then
  if [[ -f "$SETTINGS_FILE" ]]; then
    ORIENTATION="$(sed -n 's/.*"orientation"[[:space:]]*:[[:space:]]*"\([a-z]*\)".*/\1/p' "$SETTINGS_FILE")"
  fi
  ORIENTATION="${ORIENTATION:-landscape}"
fi

OUTPUT_NAME="${DESKOS_OUTPUT_NAME:-$(wlr-randr | head -n1 | awk '{print $1}')}"

case "$ORIENTATION" in
  portrait)
    TRANSFORM="90"
    ;;
  landscape)
    TRANSFORM="normal"
    ;;
  *)
    echo "ERROR: usage: $0 portrait|landscape" >&2
    exit 1
    ;;
esac

wlr-randr --output "${OUTPUT_NAME}" --transform "${TRANSFORM}"
