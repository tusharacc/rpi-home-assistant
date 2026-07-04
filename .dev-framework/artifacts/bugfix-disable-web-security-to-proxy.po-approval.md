# PO Approval: Replace --disable-web-security with backend proxy approach

## Executor Findings Summary

All 8 test cases pass. The workspace's net effect: a proxy-based fix was
attempted, found to be fundamentally broken (can't forward the Google SSO
session; breaks past the initial page load; escalates iframe sandbox trust),
and reverted per user decision back to `--disable-web-security` — the same
approach the original `add-epaper-subscriptions` feature already validated on
real hardware. `CLAUDE.md` and `README.md` now correctly document why, closing
the policy/architecture-decision conflict that opened this bugfix in the
first place.

## PO Decision

**Approved.**

## Notes

- Net code change from `main`: none (this workspace returns the app to its
  previously-shipped behavior). The value delivered is entirely in the
  documentation fix — `CLAUDE.md`'s iframe embedding policy no longer
  contradicts the reasoned decision already on record in
  `add-epaper-subscriptions.architect.md`.
- No RPi hardware retest required; behavior is unchanged from what was already
  validated for the `add-epaper-subscriptions` feature.
- Suggest archiving this workspace once merged.
