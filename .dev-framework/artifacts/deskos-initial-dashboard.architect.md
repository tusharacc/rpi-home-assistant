# DeskOS Initial Dashboard - Architecture

**Feature:** deskos-initial-dashboard  
**Status:** In Progress (Architect Phase)  
**Created:** 2026-06-21

---

## System Design

### Overview

DeskOS is a monorepo with two top-level packages:

```
deskos/
├── packages/
│   ├── frontend/          # React + Vite + TypeScript
│   └── backend/           # Node.js + Express
├── package.json           # root workspace (npm workspaces)
└── .dev-framework/
```

The backend serves the compiled frontend bundle and acts as the future API gateway. In development, Vite's dev server proxies API calls to the Express backend.

### Runtime Architecture

```
Browser (windowed/kiosk)
  └── React App (Vite SPA)
        ├── Shell Layout
        │     ├── Sidebar (plugin-driven nav)
        │     └── Content Area (active plugin renderer)
        └── Plugin Registry
              ├── NewsPlugin (stub)
              └── RpiDesktopPlugin (stub)

Express Server (port 3001)
  └── Static file serving (production)
  └── /api/* (future)
```

---

## Content Area: iframe vs React Container Decision

**Decision: Dual-mode content area (iframe + React container)**

Rationale:
- ePaper sources (The Hindu, LiveMint) require isolated sessions → must use `<iframe>`
- Future native modules (investments, weather) are React components → need React container
- Plugin interface declares which mode it needs via `contentMode: 'iframe' | 'react'`

The content area renders either mode based on the active plugin's declaration. Only one is mounted at a time.

---

## Components

### Frontend Package

```
packages/frontend/src/
├── main.tsx                    # React entry point
├── App.tsx                     # Root: Shell layout mount
├── shell/
│   ├── Shell.tsx               # Full-window layout: Sidebar + ContentArea
│   ├── Sidebar/
│   │   ├── Sidebar.tsx         # Sidebar container, reads plugin registry
│   │   ├── SidebarWidget.tsx   # Top-level expandable widget
│   │   ├── SidebarItem.tsx     # Leaf nav item (icon + label + fine-print)
│   │   └── Sidebar.module.css
│   └── ContentArea/
│       ├── ContentArea.tsx     # Mounts IframeContainer or ReactContainer
│       ├── IframeContainer.tsx # Sandboxed iframe for external content
│       ├── ReactContainer.tsx  # Error-boundary-wrapped React plugin render
│       └── ContentArea.module.css
├── plugins/
│   ├── registry.ts             # Plugin registration, lookup, active state
│   ├── types.ts                # Plugin interface + types
│   ├── news/
│   │   └── NewsPlugin.ts       # Stub: declares sub-items, no render yet
│   └── rpi-desktop/
│       └── RpiDesktopPlugin.ts # Stub: placeholder render
├── state/
│   └── navigationState.ts      # localStorage persistence of nav state
└── index.css                   # Global reset + CSS vars
```

### Backend Package

```
packages/backend/src/
├── index.ts          # Express app: static serving + /api stub
└── types.ts          # Shared types (minimal in this feature)
```

---

## Data Models

### Plugin Interface (`plugins/types.ts`)

```typescript
export type ContentMode = 'iframe' | 'react';

export interface PluginSubItem {
  id: string;
  label: string;
  finePrint?: string;
  icon?: ReactNode;
  contentMode: ContentMode;
  iframeSrc?: string;           // required if contentMode === 'iframe'
  render?: () => ReactNode;     // required if contentMode === 'react'
}

export interface Plugin {
  id: string;
  name: string;
  finePrint?: string;
  icon: ReactNode;
  contentMode: ContentMode;
  subItems?: PluginSubItem[];   // if present, top-level item is expandable
  iframeSrc?: string;
  render?: () => ReactNode;
  activate: () => void;
  deactivate: () => void;
  refresh: () => void;
}
```

### Navigation State (`state/navigationState.ts`)

Persisted to `localStorage` under key `deskos_nav_state`:

```typescript
interface NavState {
  activeItemId: string | null;       // currently selected leaf item id
  expandedWidgets: string[];         // plugin ids with expanded sub-items
}
```

### Plugin Registry (`plugins/registry.ts`)

```typescript
// In-memory registry — populated at app init
interface PluginRegistry {
  plugins: Plugin[];
  getPlugin(id: string): Plugin | undefined;
  getActivePlugin(): Plugin | PluginSubItem | undefined;
}
```

---

## API Contracts

No API endpoints in this feature. Express serves only static files.

Future stub endpoint (not implemented here):
- `GET /api/health` → `{ status: 'ok' }`

---

## Tech Decisions

| Decision | Choice | Reason |
|---|---|---|
| Monorepo structure | npm workspaces | Simple, no extra tooling, native to npm |
| CSS approach | CSS Modules | Scoped styles, no runtime overhead, works with Vite |
| State management | React `useState` + `useReducer` + localStorage | No Redux needed at this scale |
| Plugin registration | Static imports at app init | Simple; dynamic loading is future work |
| Content area | Dual-mode (iframe + react) | Satisfies both ePaper and native module needs |
| Sidebar width | 260px fixed | Fits icon (24px) + label + fine-print with comfortable padding |
| Error isolation | React Error Boundary on ContentArea | Shell survives plugin crashes |
| TypeScript config | `strict: true` | Required per PO NFRs |

---

## Directory Structure (Full)

```
rpi-home-assistant/
├── packages/
│   ├── frontend/
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       └── [see Components above]
│   └── backend/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts
├── package.json          # npm workspaces root
├── .gitignore
└── .dev-framework/
```

---

## Open Questions

- None blocking. Dual-mode content area resolves the iframe vs React question from PO.
- Sidebar icon library to use: the developer/designer should pick (Lucide React recommended — lightweight, TypeScript-native).
