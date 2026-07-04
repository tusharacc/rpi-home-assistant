#!/usr/bin/env bash
set -euo pipefail

# Args: on | off
# TODO(architect open question): confirm labwc vs wayfire on the deployed Pi
# — this currently assumes wlr-randr (labwc).

# deskos-backend.service doesn't inherit the graphical session's environment
# either, so wlr-randr needs these discovered explicitly — see
# apply-orientation.sh for the fuller explanation.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if [[ -z "${WAYLAND_DISPLAY:-}" ]]; then
  export WAYLAND_DISPLAY="$(ls -1 "${XDG_RUNTIME_DIR}" 2>/dev/null | grep -E '^wayland-[0-9]+$' | head -n1)"
fi
if [[ -z "${WAYLAND_DISPLAY:-}" ]]; then
  echo "ERROR: no Wayland display socket found in ${XDG_RUNTIME_DIR}" >&2
  exit 1
fi

STATE="${1:-}"
OUTPUT_NAME="${DESKOS_OUTPUT_NAME:-$(wlr-randr | head -n1 | awk '{print $1}')}"

case "$STATE" in
  on)
    wlr-randr --output "${OUTPUT_NAME}" --on
    ;;
  off)
    wlr-randr --output "${OUTPUT_NAME}" --off
    ;;
  *)
    echo "ERROR: usage: $0 on|off" >&2
    exit 1
    ;;
esac
