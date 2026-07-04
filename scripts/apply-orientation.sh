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
