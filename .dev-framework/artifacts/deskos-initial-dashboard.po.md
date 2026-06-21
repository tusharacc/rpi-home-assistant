# DeskOS Initial Dashboard - Requirements

**Feature:** deskos-initial-dashboard  
**Status:** Complete (PO Phase)  
**Created:** 2026-06-21

---

## Problem Statement

Build the DeskOS shell: a full-screen personal information appliance UI running on Raspberry Pi with a portable monitor. This feature covers the foundational infrastructure — the app shell, sidebar navigation, and content container — with no application modules yet. Subsequent features will add modules (news, investments, etc.) that plug into this shell.

**Scope of this feature:** App shell only. No newspaper reader, no news aggregation, no RPi-specific services. Subsequent feature: News Module.

---

## Feature Sequencing

This is Feature 1 of N:

| # | Feature | Description |
|---|---------|-------------|
| 1 | **deskos-initial-dashboard** (this) | App shell: layout, sidebar, content container, plugin architecture |
| 2 | deskos-news-module | News widget: The Hindu ePaper, LiveMint ePaper, aggregated news |
| 3+ | deskos-rpi-kiosk | Chromium kiosk config, systemd startup, RPi-specific services |

---

## User Stories

- As a user, I want a persistent sidebar so I can navigate between modules without losing my place.
- As a user, I want sidebar items with icons and descriptive text so I can identify modules at a glance.
- As a user, I want the content area to load module content without full page refreshes.
- As a developer, I want a plugin interface so future modules can be registered without modifying core shell code.

---

## Functional Requirements

### Layout
- Full-window layout: fixed sidebar on the left, content area fills the remainder
- Content area renders module content in an iframe or managed container (decision for architect)
- No page chrome, no browser toolbars visible (windowed during dev, kiosk on RPi)

### Sidebar
- Fixed width: wide enough for icon + label + fine-print (approx 220–280px, exact to architect/designer)
- Sidebar navigation state is persisted (survives page refresh; localStorage is acceptable)
- Sidebar items are widget-based with expandable sub-items
- Initial sidebar widgets (shell only, no content implementation):
  - **News** (expandable)
    - The Hindu
    - LiveMint
    - Other News
  - **Raspberry Pi Desktop** (placeholder, no implementation)
- Future widgets (placeholders only, no implementation): Investments, Home Automation, AI Assistant, Calendar, Weather, Garden, Settings

### Content Container
- When a sidebar item is selected, the content container updates to show that module's content
- Container must support iframe embedding (for ePaper sources in future news module)
- Active/selected sidebar item is visually highlighted
- No content loads by default (or a welcome/home screen — to be decided in design)

### Plugin Architecture
- Frontend plugin interface defined:
  - `id: string`
  - `name: string`
  - `icon: ReactNode`
  - `render(): ReactNode`
  - `activate(): void`
  - `deactivate(): void`
  - `refresh(): void`
- Plugins registered in a central plugin registry
- Sidebar auto-generates from registered plugins

---

## Non-Functional Requirements

- **Tech Stack:** React 18+, TypeScript, Vite
- **Backend:** Node.js + Express (minimal, serves the frontend bundle; no business logic in this feature)
- **Database:** None in this feature
- **Dev target:** macOS, windowed browser (not kiosk)
- **Deploy target:** Raspberry Pi OS, Chromium kiosk mode
- **Code must run identically on macOS and Raspberry Pi** — no platform-specific code in this feature
- **No mock RPi implementations** — RPi-specific features handled in a later dedicated feature
- **TypeScript strict mode** throughout frontend and backend

---

## Acceptance Criteria

- [ ] App launches on macOS via `npm run dev` (or equivalent) and opens in a browser window
- [ ] Sidebar renders with correct widget structure: News (expandable with 3 sub-items), Raspberry Pi Desktop
- [ ] Sidebar is wide enough to display icon + label + fine-print without clipping
- [ ] Clicking a sidebar item highlights it and updates the content area
- [ ] Expanding the News widget reveals The Hindu, LiveMint, Other News sub-items
- [ ] Navigation state (which item is selected, which widgets are expanded) persists across page refresh
- [ ] Plugin registry exists and News/RpiDesktop are registered as plugins via the interface
- [ ] Content container can render an iframe (validate with a test URL such as `example.com`)
- [ ] Layout fills the full browser window with no overflow or scrollbars on sidebar
- [ ] TypeScript compiles with no errors in strict mode

---

## Edge Cases

- Sidebar expanded/collapsed state should be independent per widget (expanding News does not collapse other widgets)
- If a plugin fails to render, the shell should not crash (error boundary on content container)
- On very small screens (dev resize) sidebar should not overlap content (minimum content width constraint)

---

## Dependencies

- None external in this feature
- Subsequent news module will depend on this shell being in place

---

## Scope

### In Scope
- React + Vite + TypeScript project scaffolding
- Express backend serving the frontend bundle
- Sidebar layout with plugin-based navigation
- Content container (iframe-capable)
- Plugin interface and registry
- Navigation state persistence (localStorage)
- Design via frontend-design skill

### Out of Scope
- Actual news content, ePaper loading (News Module feature)
- Chromium kiosk configuration (RPi Kiosk feature)
- RPi systemd startup (RPi Kiosk feature)
- Any RPi-specific hardware APIs (GPIO, brightness, shutdown)
- Authentication / session management
- Database

---

## Notes

- The frontend-design skill should be invoked during the Developer phase to generate the UI
- Sidebar widget hierarchy: top-level = module group (e.g. News), second-level = specific sources/views
- "Raspberry Pi Desktop" sidebar item will eventually exit kiosk mode on RPi; no implementation needed now
- Architecture decision needed: iframe vs. React-managed container for content area (tradeoffs: iframe isolates sessions for ePaper logins, React container is more flexible for native React modules)
