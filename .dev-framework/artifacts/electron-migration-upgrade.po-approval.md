# PO Approval — Electron Migration Upgrade

Input: `artifacts/electron-migration-upgrade.executor.md`

## Executor Findings Summary

Core deliverable (genuine sidebar+embedded-epaper co-visibility, replacing the iframe/separate-window
approaches) is confirmed working live on the actual Pi, including epaper sign-in, the Other News
reading queue, PDF viewing, and the deploy loop — each validated through real hands-on use, with six
real bugs found and fixed along the way that no amount of static review would have caught (exact
identity-provider domains, exact PDF URL schemes, a deploy-script data-loss bug).

Known gaps, none of which surfaced any problem during the session but weren't positively exercised
either: LiveMint sign-in, reboot persistence, orientation rotation with an embedded view active, Exit
to Desktop on the Pi itself, RAM usage, and Shutdown.

## PO Decision

**Approved.** This is a single-user personal appliance with one operator (the PO) who did the actual
hardware testing directly — the gaps above are acceptable ship risk here in a way they wouldn't be for
a multi-user or externally-distributed product: if LiveMint or reboot persistence turns out to have an
issue, it's a fast, low-stakes fix-and-redeploy cycle on hardware the PO already has full access to,
not a release that ships to anyone else first.

## Notes

- LiveMint should be the first thing checked next time the device is used, given The Hindu needed two
  separate live-discovered fixes (FedCM, Piano ID) before its sign-in worked — LiveMint may need its
  own identity-provider allowlist entry if it uses a different provider.
- `deploy-to-pi.sh`'s `--push-local-db` flag exists now specifically to prevent a repeat of the
  data-loss bug found this session — worth remembering it's opt-in only, not the old default.
- Merging to `main` and archiving this workspace next.
