# 04: Open Once Per Version

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

After an update, What's New opens by itself once for the new version, on every build target and channel. Other startup prompts wait their turn. The spec covers this in Q2, Q3, Q4, Q8, Q11 and Q16, and in the "Open-once rule" and "Startup ordering" decisions.

- **Record.** A per-device record holds the last version for which What's New opened. It lives beside the First-Time Flow records and is never exported.
- **Rule.** What's New opens when the record differs from the installed version. A fresh install records the version without opening. "Fresh" means the welcome intro has not been seen. A missing record alone does not mean fresh, because every existing player has no record when this feature first ships. Dev builds open it only through the dev route.
- **Ordering.** What's New waits for the welcome intro and the First-Time Flow step, as the event poster already does. While What's New is due or open, the event acknowledge poster and the main-menu tutorial stay held. They show after it closes.

## Acceptance criteria

- [ ] Host tests: What's New opens once for a new version, stays closed on the next launch, and opens again for the next version.
- [ ] Host tests: a fresh install records the version without opening, and an existing player with no record sees it open.
- [ ] Host tests: the event acknowledge poster and the main-menu tutorial stay held while What's New is open, and show after it closes.
- [ ] Each guard is proven to bite by reinstating its bug once.
- [ ] The rule behaves the same on web, desktop and Android (one code path, no per-target branch).
