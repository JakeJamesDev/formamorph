# 17: Contribution Entity Names

Status: ready-for-human
Blocked by: 16
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The client half of spec Q71: staff read names, not raw ids, in the Mentions review tab.

- **Send:** each contribution carries `entityNames` for every entity its clusters, cluster entities and corrections reference, including the persona. Names are the world's names with placeholders resolved, the same resolution the narration uses.
- **Staff tab:** each link shows the entity's name. An item without a name for an id falls back to the id.
- **Changelog:** none (staff tooling).

## Acceptance criteria

- [x] A contribution from a world whose entity name holds a placeholder sends the resolved name, never the raw token. The test is proved by reinstating the bug. `contributionNames.test.tsx` runs a placeholder world through `useResolvedWorld` (cast and persona). Reinstated: a raw cast in GameViewer fails the source scan; dropping the persona fails both tests.
- [x] The staff tab shows names, and the id when a name is missing. `MentionsTab.test.tsx` "shows the names the contribution sent, and the id where it sent none", plus an id named `constructor`.
- [x] Frame of the staff tab with names, for the user. `.scratch/character-mentions-17/frames/mentions-tab-names.png` (dev stub: "Mira Vell → Kessa", id fallback "ferryman").

## Landed

**Not verified**

- None.

**For you**

- The staff tab with names: `.scratch/character-mentions-17/frames/mentions-tab-names.png`. The tutorial popover and an auth toast in the frame come from the dev preview, not this change.
- A name the server would refuse (blank, over 200 characters) is left out, so staff see that entity's id.
