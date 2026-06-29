# DeskOS Initial Dashboard - Tester Artifact

**Feature:** deskos-initial-dashboard  
**Status:** In Progress  
**Created:** 2026-06-29

---

## Test Plan

Validate the DeskOS shell: sidebar navigation, plugin registry, content area rendering, localStorage persistence, and backend health endpoint. All test cases are written only — execution is handled by the Executor phase.

---

## Test Cases

### TC-01 — App loads without errors

**Input:** Navigate to `http://localhost:3001` in browser  
**Expected:** DeskOS shell renders with sidebar and content area; no console errors  
**Edge cases:** Hard refresh, first-ever load with no localStorage data

---

### TC-02 — Sidebar navigation items render

**Input:** App loaded  
**Expected:** At least one sidebar item is visible; items match plugin registry entries  
**Edge cases:** Plugin registry empty (should render gracefully with no items)

---

### TC-03 — Clicking a sidebar item activates it

**Input:** Click a sidebar item  
**Expected:** Item shows active state; content area updates to show that plugin's content  
**Edge cases:** Clicking already-active item (should be idempotent)

---

### TC-04 — Navigation state persists across page reload

**Input:** Click a sidebar item, then reload the page  
**Expected:** Previously active item is still active after reload; `activeItemId` restored from localStorage  
**Edge cases:** Corrupted localStorage value (see TC-07)

---

### TC-05 — Expandable sidebar widgets expand and collapse

**Input:** Click an expandable widget header  
**Expected:** Widget expands showing sub-content; click again collapses it; `expandedWidgets` updated in localStorage  
**Edge cases:** Multiple widgets expanded simultaneously

---

### TC-06 — Backend health endpoint responds

**Input:** `GET http://localhost:3001/api/health`  
**Expected:** `{ "status": "ok", "version": "0.1.0" }` with HTTP 200  
**Edge cases:** Backend not running (connection refused)

---

### TC-07 — Corrupted localStorage falls back to default state

**Input:** Set `localStorage.setItem('deskos_nav_state', '{"activeItemId":123,"expandedWidgets":"bad"}')` in browser console, then reload  
**Expected:** App loads without throwing; default state applied (no active item, no expanded widgets)  
**Edge cases:** `null` stored, empty string stored, valid JSON but wrong schema

---

### TC-08 — Express catch-all does not intercept API routes

**Input:** `GET http://localhost:3001/api/health` with backend running  
**Expected:** Returns JSON `{ status: 'ok' }`, not HTML  
**Edge cases:** `GET /api/nonexistent` should return 404 JSON or Express default, not `index.html`

---

### TC-09 — App serves `index.html` for unknown frontend routes (SPA routing)

**Input:** Navigate to `http://localhost:3001/some/deep/route`  
**Expected:** `index.html` returned (not 404); React router handles the path client-side  
**Edge cases:** Trailing slash, query params

---

### TC-10 — Terminal Amber UI theme applied

**Input:** App loaded  
**Expected:** Amber/terminal colour palette visible in sidebar and UI chrome; no default browser unstyled appearance

---
