import path from 'path'

// __dirname here is compiled dist/paths.js, sibling to dist/index.js — same
// depth as FRONTEND_DIST in index.ts, so the repo root needs the same three
// '../' segments (dist -> backend -> packages -> repo root).
export const REPO_ROOT = path.join(__dirname, '../../..')
export const SCRIPTS_DIR = path.join(REPO_ROOT, 'scripts')
export const DATA_DIR = path.join(__dirname, '../data')
