# DeskOS Initial Dashboard - Reviewer Artifact

**Feature:** deskos-initial-dashboard  
**Status:** Returning to Developer — Medium issues found  
**Created:** 2026-06-21

---

## Review Summary

Reviewed all 28 source files. Architecture is solid, TypeScript is strict-clean, plugin system is well-structured, and security posture is appropriate for a personal appliance. Two medium issues need fixing before advancing: unsafe localStorage deserialization and a wildcard Express route ordering fragility. Four low-severity items filed as bugs.

---

## Issues by Severity

### High

None.

---

### Medium

**M-1 — Unsafe localStorage deserialization (`navigationState.ts:17`)**

```typescript
return JSON.parse(raw) as NavState  // no shape validation
```

`JSON.parse` + `as NavState` is an unsafe cast. If the stored value was written by a different version of the app (schema change) or is malformed, the returned object may have wrong field types. `expandedWidgets.includes()` and `.filter()` in `Shell.tsx` will throw at runtime if `expandedWidgets` is not an array.

**Fix:** Validate the parsed shape and fall back to default on mismatch:
```typescript
const parsed = JSON.parse(raw)
if (
  parsed !== null &&
  typeof parsed === 'object' &&
  (parsed.activeItemId === null || typeof parsed.activeItemId === 'string') &&
  Array.isArray(parsed.expandedWidgets)
) {
  return parsed as NavState
}
return defaultState
```

---

**M-2 — Express wildcard catch-all can swallow future API routes (`backend/src/index.ts:16`)**

```typescript
app.get('*', (_req, res) => {  // must stay LAST — any route added after this is unreachable
  res.sendFile(...)
})
```

The catch-all is correctly positioned now, but there is no guard preventing future API routes from being added after it. Express silently matches the wildcard first, returning HTML instead of JSON — hard to debug.

**Fix:** Add a comment guard AND scope the wildcard to exclude `/api/*`:
```typescript
// IMPORTANT: keep this last — all routes above this line are API routes
app.get(/^(?!\/api).*$/, (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'))
})
```

---

### Low

**L-1 — `defaultState` returned by reference in `navigationState.ts:16`**

`return defaultState` returns a direct reference. Any caller that mutates the returned object would corrupt the singleton default. Should return `{ ...defaultState }`.

**L-2 — Missing `aria-expanded` on expandable `SidebarWidget` header**

`role="button"` with expand/collapse behaviour should include `aria-expanded={isExpanded}` for screen reader compatibility.

**L-3 — No visible focus ring in sidebar CSS**

Keyboard navigation works (tabIndex + onKeyDown) but no visible focus outline is defined. Browser defaults are often suppressed by CSS resets.

**L-4 — Long JSX attribute line on `SidebarWidget.tsx:38`**

`onClick`, `role`, `tabIndex`, and `onKeyDown` all on the same element with no line breaks — readability concern only, not functional.

---

## Approval Status

- [ ] Approved
- [x] **Rejected — return to developer**

**Developer must fix M-1 and M-2 before next hand-off. L-1 through L-4 are filed as bugs and do not block advancement.**
