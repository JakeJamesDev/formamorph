# 07: One Owners Row on Hover Cards

Status: done
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: visible card behavior on several card kinds.

## What to build

Hover cards use one **Owners** row.

- A trait card's Bearers row becomes **Owners**.
- A stat card's separate Owner row merges into **Owners**, You first (Q8).
- A Blueprint stat and a loose world stat say what they are in the signature line. A loose world stat has no Owners row.
- Owner lists carry no Linked marks (Q10).
- The "No Bearers" tag becomes "No Owners", in one casing.
- Fold a line into the rename changelog entry.

Spec: Q8, Q10, Q11; stories 4-7.

## Acceptance criteria

- [ ] A trait card lists **Owners**
- [ ] A Blueprint stat card shows one Owners row, You first, and names the Blueprint in its signature
- [ ] A loose world stat card names itself in its signature and shows no Owners row
- [ ] No Linked marks in owner lists; "No Owners" in one casing
- [ ] Verified in the live preview with `verify-ui`; four gates green

## Blocked by

- 06
