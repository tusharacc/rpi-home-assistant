# Add Epaper Subscriptions — Reviewer Artifact

**Feature:** add-epaper-subscriptions  
**Status:** Issues found — returning to developer  
**Created:** 2026-06-29

---

## Review Summary

TypeScript: clean on both packages. Shell scripts: well-formed with `set -euo pipefail` and properly quoted variables. One medium issue found that will cause the service to fail on first RPi deployment.

---

## Issues by Severity

### Medium

**M-1: Backend service will fail — `node dist/index.js` requires a compiled backend that the documented build step does not produce**

`scripts/deskos-backend.service` runs `npm run start --workspace=packages/backend`, which resolves to `node dist/index.js` in the backend package. This file requires `packages/backend` to be compiled via `tsc`. However:

- The root `build` script (`npm run build`) only builds the frontend (`npm run build -w packages/frontend`).
- The README setup section instructs `npm run build` — this does NOT compile the backend.
- On a fresh RPi deploy, `packages/backend/dist/` will not exist and the service will immediately crash on start.

Fix: Update the root `package.json` `build` script to build both packages, then update the README step accordingly:
```json
"build": "npm run build -w packages/frontend && npm run build -w packages/backend"
```

### Low

**L-1: `chromium-browser` binary name may differ on Raspberry Pi OS Bookworm**

Recent versions of Raspberry Pi OS (Bookworm) ship Chromium as `chromium`, not `chromium-browser`. The launch script hardcodes `chromium-browser`. If installed via `apt install chromium`, the script will fail with "command not found".

Fix: Use `command -v chromium-browser chromium 2>/dev/null | head -1` to detect which binary is present, or add a comment in the script noting that users on Bookworm may need to change the binary name.

---

## Approval Status

- [ ] Approved
- [x] Rejected — return to developer to fix M-1

---

## Notes

No security issues. `--disable-web-security` is intentional and documented. No credentials in code. Shell variables are properly quoted. The sandbox attribute on `IframeContainer.tsx` was reviewed and is correct — no change needed.
