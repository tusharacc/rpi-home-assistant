# Add Epaper Subscriptions — Tester Artifact

**Feature:** add-epaper-subscriptions  
**Status:** Test cases written — ready for executor  
**Created:** 2026-06-29

---

## Test Plan

Validates: kiosk launch script correctness, backend build completeness, iframe rendering pipeline, and documentation accuracy. The RPi-specific tests (actual kiosk on device) are scoped as notes — executor validates what is testable in the dev environment.

---

## Test Cases

### TC-01 — Build script compiles both packages
**Input:** Run `npm run build` from repo root on a clean checkout (no existing `dist/` directories)  
**Expected:** `packages/backend/dist/index.js` exists AND `packages/backend/dist/frontend/index.html` exists after build completes without error  
**Edge case:** Backend must compile before frontend since frontend output lands in backend dist

### TC-02 — Backend starts via `npm start` after build
**Input:** After `npm run build`, run `npm start` from repo root  
**Expected:** Express server starts and `GET http://localhost:3001/api/health` returns `{"status":"ok","version":"0.1.0"}` with status 200

### TC-03 — launch-kiosk.sh is executable and parses correctly
**Input:** Run `bash -n scripts/launch-kiosk.sh` (syntax check) and verify `ls -l scripts/launch-kiosk.sh` shows execute bit set  
**Expected:** No syntax errors; file has `x` permission

### TC-04 — launch-kiosk.sh binary detection logic (mock test)
**Input:** In a shell, run: `command -v chromium-browser || command -v chromium`  
**Expected:** Returns a non-empty path if either binary is installed. On macOS dev machine, neither may be installed — verify the script's error message is clear: `ERROR: Chromium not found. Install with: sudo apt install chromium-browser`

### TC-05 — The Hindu sidebar item loads iframe in DeskOS (dev server)
**Input:** Start dev server (`npm run dev`), open `http://localhost:3000`, expand News in sidebar, click "The Hindu"  
**Expected:** Content area switches to iframe mode. The iframe element is present in the DOM with `src="https://epaper.thehindu.com"`. On macOS dev without `--disable-web-security`, the iframe will show a blocked/empty frame — this is expected and correct (not a bug in DeskOS code).

### TC-06 — LiveMint sidebar item loads iframe in DeskOS (dev server)
**Input:** Same as TC-05, click "LiveMint"  
**Expected:** Iframe present in DOM with `src="https://epaper.livemint.com"`. Same blocked-frame expectation applies on macOS dev.

### TC-07 — IframeContainer sandbox attributes are correct
**Input:** In browser devtools (DeskOS running, The Hindu selected), inspect the iframe element  
**Expected:** `sandbox` attribute contains: `allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox`

### TC-08 — Navigation state persists after clicking epaper items
**Input:** Click "The Hindu", reload page, check localStorage  
**Expected:** `activeItemId` in localStorage equals `"news-the-hindu"`; on reload, The Hindu iframe loads automatically

### TC-09 — systemd service files have correct syntax
**Input:** Run `systemd-analyze verify scripts/deskos-backend.service scripts/deskos-kiosk.service` (if systemd available) or manually inspect for required `[Unit]`, `[Service]`, `[Install]` sections  
**Expected:** Both files contain all three sections; `ExecStart` paths are set; no obvious syntax errors

### TC-10 — README setup instructions are complete and accurate
**Input:** Read README RPi Setup section and trace through each step manually  
**Expected:** Steps 1–5 are sufficient to go from a fresh RPi OS install to a running DeskOS kiosk; the one-time epaper auth procedure references the correct sidebar path (News → The Hindu / News → LiveMint)
