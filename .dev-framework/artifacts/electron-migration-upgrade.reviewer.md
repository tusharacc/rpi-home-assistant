# Reviewer — Electron Migration Upgrade

Input: `artifacts/electron-migration-upgrade.developer.md`

## Review Summary

Round 2. Round 1's code-quality gate (`electron-migration-upgrade.code-quality-report.md`) blocked on
one MEDIUM secure-coding finding (SC-08: `embed:show`'s IPC handler trusted the renderer's `url`
argument without validating it against known embeddable sites) and noted one LOW advisory (missing
`event.sender` verification). Both were fixed directly by Developer in the follow-up commit
(`fix(electron): validate embed:show URL against allowlist, verify IPC sender`), along with applying
the round-1 Simplify advisory (collapsing `ContentArea.tsx`'s five near-identical wrapper blocks into
one). Re-ran the full code-quality gate against the current diff:

- **Simplify**: no new findings. The one round-1 finding (`ContentArea.tsx` wrapper duplication) was
  applied and verified against the current file content — matches the proposed replacement exactly,
  all branch conditions preserved.
- **Secure Coding**: `EMBEDDABLE_VIEWS` allowlist check confirmed present in `main.ts` (`embed:show`
  now rejects any `url` that doesn't match the expected value for `viewId`); `event.sender` check
  confirmed present in both `embed:show` and `embed:hide`. No new violations introduced by the fix
  commit itself (re-checked SC-01 through SC-12 against the full branch diff, not just the delta).
- **Secret Detection**: PASSED, 0 findings (consistent across every commit on this branch, pre-commit
  hook enforced).

Beyond the code-quality gate, manually reviewed the rest of the developer artifact's claims against
actual code:
- Confirmed `contextIsolation: true`/`nodeIntegration: false`/`sandbox: true` set on both the main
  `BrowserWindow` and every `BrowserView` (`main.ts:41-49`, `79-97`).
- Confirmed `setWindowOpenHandler` denies on both (`main.ts:54`, `99`).
- Confirmed embedded `BrowserView`s have no `preload` set in their `webPreferences` — `window.deskosElectron`
  is correctly scoped to the trusted main window only, not exposed to embedded third-party content.
- Confirmed `showEmbeddedView`/`hideEmbeddedView` detach (`removeBrowserView`) rather than destroy views,
  satisfying the PO's "stay alive across navigation" requirement.
- Confirmed `exit-to-desktop`/`shutdown` routes in `system.ts` are byte-for-byte unchanged except the
  `open-epaper`-specific imports/constants/route being removed — matches the architect's claim that
  these needed zero changes.
- Confirmed `scripts/apply-orientation.sh`/`scripts/hdmi-power.sh` have no diff in this branch — matches
  the architect's claim they're unaffected.
- Confirmed `electron` is pinned exact (`"43.1.0"`, not `^43.1.0`) in `packages/electron/package.json`.
- Confirmed no `any` introduced anywhere in the branch diff (grep across all changed `.ts`/`.tsx` files).

Full build (`npm run build`) and per-package typecheck (`tsc --noEmit`) all pass clean as of this
commit — re-verified, not just trusted from the developer artifact.

## Issues by Severity

### High

None.

### Medium

None. (Round 1's MEDIUM finding is resolved — see Review Summary.)

### Low

None new. Round 1's LOW finding is resolved (fixed directly, not deferred as a bug).

One item carried forward as **known, accepted, and already explicitly documented** risk rather than a
new reviewer finding — the developer artifact's own "Open Items for Tester/Executor" already lists it,
so it isn't being re-raised here as something the developer missed:
- The actual `kiosk: true` window launch, `BrowserView` rendering/bounds correctness, sign-in flow, and
  on-device Node-version/RAM numbers are **all unverified** — nothing in this branch has been run on
  real hardware or even launched locally as a real window (deliberately, to avoid taking over the local
  dev machine's screen without asking). This is not a code-quality defect; it's the expected gap between
  "typechecks and builds" and "actually works," and it is Tester/Executor's job next, not Reviewer's.

## Approval Status

**APPROVED.** No High/Medium issues outstanding. Advancing to Tester — whose primary job here is
unusually load-bearing given how much of this upgrade could only be verified statically (types, build)
rather than at runtime (no Pi access, no unprompted kiosk-window launch on the dev machine).
