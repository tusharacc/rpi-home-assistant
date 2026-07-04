# Add Epaper Subscriptions — PO Requirements

**Feature:** add-epaper-subscriptions  
**Status:** Complete  
**Created:** 2026-06-29

---

## Problem Statement

The Hindu and LiveMint sidebar items in DeskOS currently point to the correct epaper URLs but do not produce a usable epaper experience. Two blockers prevent this:

1. Both epaper sites send `X-Frame-Options: SAMEORIGIN`, which causes Chromium to refuse rendering them inside the DeskOS iframe.
2. No setup procedure exists for the one-time subscriber login, which requires Google SSO (account: tusharacc@gmail.com).

The fix must work on a device with no keyboard in normal operation — all navigation inside the epaper must be possible with a pointing device only.

---

## User Stories

- As a user, when I click "The Hindu" in the sidebar, the full Hindu epaper reader loads in the content area and I can browse it using the pointing device.
- As a user, when I click "LiveMint" in the sidebar, the full LiveMint epaper reader loads in the content area and I can browse it using the pointing device.
- As a setup technician (same person, during initial RPi configuration with keyboard attached), I can log in to both epaper sites via Google SSO so that future keyboardless sessions are pre-authenticated.

---

## Functional Requirements

1. **Iframe loads epaper content** — The content area must successfully render `epaper.thehindu.com` and `epaper.livemint.com` without blank frame or security error.
2. **Chromium kiosk launch flags** — The RPi Chromium launch command must include `--disable-web-security` (and `--user-data-dir`) so iframe X-Frame-Options restrictions are bypassed.
3. **Persistent session** — Chromium user profile directory must persist across reboots so the Google SSO session cookie survives power cycles.
4. **No login UI in DeskOS** — DeskOS never shows a login prompt, credential form, or any text input for authentication. Authentication is entirely delegated to the Chromium session.
5. **Iframe sandbox permissive enough** — The iframe `sandbox` attribute must permit scripts, same-origin access, forms, and popups (needed for Google OAuth popup during initial setup). Evaluate whether sandbox should be dropped entirely for these trusted sources.
6. **Pointing-device-only navigation** — The epaper reader must be navigable via click/touch alone. No additional UI from DeskOS side is required; the epaper sites themselves handle this.

---

## Non-Functional Requirements

- No credentials, tokens, or secrets in any committed file.
- Chromium flags must be documented in README and a launch script (not hardcoded assumptions).
- The solution must work identically on macOS dev (for iframe load testing) and RPi deployment.
- macOS dev note: `--disable-web-security` must be set in the dev browser when testing iframes locally; document this in CLAUDE.md.

---

## Acceptance Criteria

- [ ] Clicking "The Hindu" in the DeskOS sidebar loads the Hindu epaper content (not a blank or error frame).
- [ ] Clicking "LiveMint" in the DeskOS sidebar loads the LiveMint epaper content.
- [ ] A `scripts/launch-kiosk.sh` (or equivalent) exists with the correct Chromium kiosk flags including `--disable-web-security` and a persistent `--user-data-dir`.
- [ ] README includes a one-time setup procedure: how to log in to both epaper sites via Google SSO (tusharacc@gmail.com) during initial RPi setup with keyboard attached.
- [ ] CLAUDE.md documents that epaper iframes require `--disable-web-security` and explains why.
- [ ] The iframe sandbox attributes are reviewed and set correctly (or removed) for epaper content.

---

## Edge Cases

- **Session expiry**: Google SSO sessions can expire. If the epaper shows a login page rather than content, the user must reconnect a keyboard and re-authenticate. This is acceptable; document in README.
- **epaper site redesign**: If the site changes its X-Frame-Options policy, the iframe may work without `--disable-web-security`. The launch flag is harmless to keep.
- **macOS dev testing**: `--disable-web-security` is not set in the dev browser by default, so iframes will likely fail locally. Dev testing of iframe content requires either a special Chromium launch or mocked content — document this explicitly.

---

## Dependencies

- Existing `IframeContainer.tsx` — already present, may need sandbox attribute update.
- Existing `NewsPlugin.tsx` — epaper URLs already correct (`epaper.thehindu.com`, `epaper.livemint.com`), no URL changes needed.
- Chromium on RPi — must support `--disable-web-security --user-data-dir` flags (standard Chromium does).
- Google account: tusharacc@gmail.com — subscriber account already created for both The Hindu and LiveMint.

---

## Out of Scope

- In-app login UI or credential management.
- On-screen keyboard.
- Session auto-renewal or re-authentication without a keyboard.
- Any changes to the "Other News" placeholder.
