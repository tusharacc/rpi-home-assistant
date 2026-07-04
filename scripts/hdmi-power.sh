#!/usr/bin/env bash
set -euo pipefail

# Args: on | off
# TODO(architect open question): confirm labwc vs wayfire on the deployed Pi
# — this currently assumes wlr-randr (labwc).

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
