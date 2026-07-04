# Add Epaper Subscriptions — Complete

**Feature:** add-epaper-subscriptions  
**Branch:** feature/add-epaper-subscriptions  
**Completed:** 2026-07-01  
**Workflow:** full (PO → Architect → Developer → Reviewer → Tester → Executor → PO Approval)

---

## Summary

Added RPi kiosk deployment infrastructure to enable The Hindu and LiveMint epaper iframes to render in DeskOS. The epaper URLs were already wired in the codebase; the missing piece was Chromium kiosk launch configuration that bypasses `X-Frame-Options: SAMEORIGIN` and preserves Google SSO session cookies across reboots.

---

## What Was Built

- **`scripts/launch-kiosk.sh`** — Chromium kiosk launch script with `--disable-web-security`, auto-detection of `chromium-browser` vs `chromium` binary (Bullseye/Bookworm), persistent `--user-data-dir`, and screen saver suppression
- **`scripts/deskos-backend.service`** — systemd unit for Express backend auto-start on boot
- **`scripts/deskos-kiosk.service`** — systemd unit for Chromium kiosk, ordered after backend and graphical target
- **`package.json` build script** — fixed to compile both backend (`tsc`) and frontend (`vite`) in correct order
- **`README.md`** — added RPi Setup section with 5-step deployment procedure, one-time epaper auth instructions (Google SSO via tusharacc@gmail.com), and `--disable-web-security` rationale
- **`CLAUDE.md`** — created with project constraints, auth approach, code rules, and iframe embedding notes

## Phase Trail

| Phase | Outcome |
|-------|---------|
| PO | Requirements complete — identified X-Frame-Options blocker and Chromium flag fix |
| Architect | Design complete — chose Chromium flag over backend proxy; confirmed iframe sandbox sufficient |
| Developer | Implementation complete — 3 new scripts + README + CLAUDE.md |
| Reviewer (round 1) | Rejected — M-1: backend build missing from root script; L-1: chromium binary name hardcoded |
| Developer (round 2) | M-1 and L-1 fixed |
| Reviewer (round 2) | Approved |
| Tester | 10 test cases written |
| Executor | 10/10 passed |
| PO Approval | Approved |

## Open Bugs (filed, non-blocking)

None from this feature. Previous open bugs remain:
- **L-2** — Missing `aria-expanded` on expandable SidebarWidget header
- **L-3** — No visible focus ring in sidebar CSS
- **L-4** — Long JSX attribute line on `SidebarWidget.tsx:38`
