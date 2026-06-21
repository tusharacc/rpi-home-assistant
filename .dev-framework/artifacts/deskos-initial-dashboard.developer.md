# DeskOS Initial Dashboard - Developer Artifact

**Feature:** deskos-initial-dashboard  
**Status:** Complete (Developer Phase)  
**Created:** 2026-06-21

---

## Implementation Plan

- [x] Scaffold monorepo (npm workspaces, root package.json)
- [x] Scaffold frontend package (Vite + React + TS)
- [x] Scaffold backend package (Express + TS)
- [x] Implement plugin types and registry
- [x] Implement navigation state persistence
- [x] Implement Shell layout (Sidebar + ContentArea)
- [x] Implement Sidebar components (Widget, Item)
- [x] Implement ContentArea (IframeContainer + ReactContainer + ErrorBoundary)
- [x] Register stub plugins (NewsPlugin, RpiDesktopPlugin)
- [x] Apply frontend-design UI (Terminal Amber aesthetic)
- [x] Verify TypeScript strict mode compiles clean

---

## Files Changed

### New files
```
package.json                                          # npm workspaces root
.gitignore
packages/frontend/package.json
packages/frontend/tsconfig.json
packages/frontend/vite.config.ts
packages/frontend/index.html                          # Google Fonts: Syne, Outfit, JetBrains Mono
packages/frontend/src/vite-env.d.ts
packages/frontend/src/index.css                       # CSS variables, global reset
packages/frontend/src/main.tsx
packages/frontend/src/App.tsx                         # Plugin registration at module init
packages/frontend/src/plugins/types.ts                # Plugin + PluginSubItem interfaces
packages/frontend/src/plugins/registry.ts             # In-memory registry with dedup
packages/frontend/src/plugins/news/NewsPlugin.tsx     # Stub with 3 sub-items
packages/frontend/src/plugins/rpi-desktop/RpiDesktopPlugin.tsx
packages/frontend/src/state/navigationState.ts        # localStorage persistence
packages/frontend/src/shell/Shell.tsx                 # Root layout, nav state coordinator
packages/frontend/src/shell/Shell.module.css
packages/frontend/src/shell/Sidebar/Sidebar.tsx       # Plugin-driven, active/coming-soon sections
packages/frontend/src/shell/Sidebar/SidebarWidget.tsx # Expandable widget, leaf/group branching
packages/frontend/src/shell/Sidebar/SidebarItem.tsx   # Sub-item renderer
packages/frontend/src/shell/Sidebar/Sidebar.module.css
packages/frontend/src/shell/ContentArea/ContentArea.tsx  # Dual-mode + live clock welcome screen
packages/frontend/src/shell/ContentArea/ContentArea.module.css
packages/frontend/src/shell/ContentArea/IframeContainer.tsx
packages/frontend/src/shell/ContentArea/ReactContainer.tsx
packages/frontend/src/shell/ContentArea/ErrorBoundary.tsx  # Class component
packages/backend/package.json
packages/backend/tsconfig.json
packages/backend/src/index.ts                         # Express, static serve, /api/health
```

---

## Code Summary

### Architecture
- npm workspaces monorepo: `@deskos/frontend` + `@deskos/backend`
- Frontend: React 18 + Vite + TypeScript strict
- Backend: Express serving static build + `/api/health`
- Fonts: Syne (display/logo), Outfit (UI labels), JetBrains Mono (fine-print)

### Design: "Terminal Amber"
- `#080808` app background with subtle dot-grid texture
- `#0E0E0E` sidebar, `#D97706` amber accent for active states
- 260px fixed sidebar: icon (18px) + label + fine-print (monospace uppercase)
- Amber left-border (3px) on active items with smooth 120ms transitions
- Pulsing green dot in sidebar footer as live indicator
- Welcome screen: large live clock (Syne 5.5rem) + date + faint DESK OS wordmark

### Plugin system
- `Plugin` interface: id, name, finePrint, icon, contentMode, subItems[], activate/deactivate/refresh
- `PluginSubItem`: same shape but with label instead of name
- Registry deduplicates on id (safe for HMR)
- Plugins registered at module init in App.tsx (no useEffect race)

### Content area
- Dual-mode: `contentMode: 'iframe'` → sandboxed iframe; `contentMode: 'react'` → ErrorBoundary-wrapped React
- iframe sandbox: `allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox`
- ErrorBoundary isolates plugin crashes from shell

### Nav state
- Stored in `localStorage` as `deskos_nav_state`: `{ activeItemId, expandedWidgets[] }`
- Loaded synchronously on first render; restored on page refresh

---

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| CSS Modules over Tailwind | CSS Modules | No build plugin needed, scoped, zero runtime |
| Plugin init | Module-level in App.tsx | Avoids useEffect timing, safe with registry dedup |
| iframe sandbox | allow-same-origin included | Required for ePaper login sessions to persist |
| TypeScript union discriminant | `'label' in item` | `Plugin` has `name`, `PluginSubItem` has `label` |
| `noUnusedLocals/Parameters` | Enabled | Enforces lean code, caught nothing (clean) |
