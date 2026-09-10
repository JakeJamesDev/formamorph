# 05: Mobile Form And Design Guide Entry

Status: ready-for-human
Base: e16d4a91
Blocked by: 03
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

Verification plus documentation. The agent prepares the mobile form and the evidence; the user approves the pattern before the guide changes.

## What to build

Below `sm`, Profile stacks into one column with the gallery first, and the three tabs fit the mobile detail view at 375px with icons and labels and no horizontal page scroll. The agent shows the mobile form in context with static evidence and asks for approval. On approval, the pattern is recorded in the Design System guide and the live showcase together, per the guide's "Adding an approved pattern" section: purpose, density, desktop and mobile behavior, component mapping, and states. Approval of the feature is not approval of the pattern; the guide entry waits for the explicit yes.

## Acceptance criteria

- [x] At 375px the tab strip shows all three tabs without horizontal page scroll and the Profile columns stack with the gallery first.
- [x] Both themes checked at desktop and mobile with static screenshots and DOM reads.
- [x] Mobile evidence presented and the user's approval recorded in the spec's Comments.
- [x] Guide section and showcase reference added together, production-backed, after approval.
- [x] Four gates green; graph updated.

## Blocked by

- 03 — Tabbed Entity Panel
