#!/usr/bin/env bash
set -euo pipefail

# Run from your Mac (or any dev machine), not on the Pi. Automates the
# "Deploying Updates" steps from README.md: transfers gitignored local state
# the Pi needs (.env, a locally-populated news.db) that `git pull` alone
# won't carry, then SSHes in to pull, build, install services, and restart.
#
# Config (env vars, or flags below):
#   DESKOS_PI_USER  -- SSH user on the Pi (required)
#   DESKOS_PI_HOST  -- Pi hostname or IP (required)
#   DESKOS_PI_DIR   -- absolute repo path on the Pi (required)
#
# Usage:
#   DESKOS_PI_USER=pi DESKOS_PI_HOST=deskos.local DESKOS_PI_DIR=/home/pi/rpi-home-assistant \
#     ./scripts/deploy-to-pi.sh
#   ./scripts/deploy-to-pi.sh --user pi --host deskos.local --dir /home/pi/rpi-home-assistant
#
# Flags:
#   --branch <name>       Branch to deploy (default: current local branch)
#   --skip-transfer       Skip scp of .env/news.db (they already match on the Pi)
#   --trigger-pipeline     After deploy, manually start the news pipeline once
#                          instead of waiting up to 3 days for the timer

PI_USER="${DESKOS_PI_USER:-}"
PI_HOST="${DESKOS_PI_HOST:-}"
PI_DIR="${DESKOS_PI_DIR:-}"
BRANCH=""
SKIP_TRANSFER=0
TRIGGER_PIPELINE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user) PI_USER="$2"; shift 2 ;;
    --host) PI_HOST="$2"; shift 2 ;;
    --dir) PI_DIR="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --skip-transfer) SKIP_TRANSFER=1; shift ;;
    --trigger-pipeline) TRIGGER_PIPELINE=1; shift ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$PI_USER" || -z "$PI_HOST" || -z "$PI_DIR" ]]; then
  echo "ERROR: missing Pi connection details." >&2
  echo "Set DESKOS_PI_USER / DESKOS_PI_HOST / DESKOS_PI_DIR, or pass --user/--host/--dir." >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

if [[ -z "$BRANCH" ]]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi

echo "==> Deploying branch '${BRANCH}' to ${PI_USER}@${PI_HOST}:${PI_DIR}"

# Deploying local-only commits makes no sense -- the Pi does its own `git
# pull`, so anything not already on origin would silently not be deployed,
# looking like a successful run that actually shipped nothing new.
if ! git diff --quiet HEAD "origin/${BRANCH}" 2>/dev/null; then
  echo "ERROR: local '${BRANCH}' differs from 'origin/${BRANCH}'." >&2
  echo "Push first: git push origin ${BRANCH}" >&2
  exit 1
fi
if ! git ls-remote --exit-code --heads origin "$BRANCH" > /dev/null 2>&1; then
  echo "ERROR: branch '${BRANCH}' does not exist on origin. Push it first." >&2
  exit 1
fi

if [[ "$SKIP_TRANSFER" -eq 0 ]]; then
  if [[ -f .env ]]; then
    echo "==> Copying .env (gitignored, git pull won't carry it)"
    scp .env "${PI_USER}@${PI_HOST}:${PI_DIR}/.env"
  fi
  if compgen -G "packages/backend/data/news.db*" > /dev/null; then
    echo "==> Copying local news.db (gitignored)"
    ssh "${PI_USER}@${PI_HOST}" "mkdir -p ${PI_DIR}/packages/backend/data"
    scp packages/backend/data/news.db* "${PI_USER}@${PI_HOST}:${PI_DIR}/packages/backend/data/"
  fi
fi

echo "==> Running remote deploy steps on the Pi"
# shellcheck disable=SC2087
ssh "${PI_USER}@${PI_HOST}" bash -s -- "$PI_DIR" "$BRANCH" "$TRIGGER_PIPELINE" <<'REMOTE'
set -euo pipefail
PI_DIR="$1"
BRANCH="$2"
TRIGGER_PIPELINE="$3"

cd "$PI_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# better-sqlite3 and electron are native/prebuilt-binary modules -- must
# install on-device (ARM), never copied over from a different architecture.
npm install
npm run build   # backend + frontend + packages/electron

# Idempotent -- re-templates and reinstalls every unit file, both sudoers
# rules, and the "Return to DeskOS" desktop icon even if nothing changed.
./scripts/install-services.sh

sudo systemctl restart deskos-backend
sudo systemctl restart deskos-kiosk

if [[ "$TRIGGER_PIPELINE" -eq 1 ]]; then
  sudo systemctl start deskos-news-pipeline.service
fi

echo "==> Post-deploy checks"
sleep 2
curl -sf http://127.0.0.1:3001/api/health && echo " -- backend healthy"
systemctl is-active deskos-backend
systemctl is-active deskos-kiosk
REMOTE

echo "==> Deploy complete."
if [[ "$TRIGGER_PIPELINE" -eq 1 ]]; then
  echo "    Pipeline triggered -- tail it with:"
  echo "    ssh ${PI_USER}@${PI_HOST} journalctl -u deskos-news-pipeline.service -f"
fi
