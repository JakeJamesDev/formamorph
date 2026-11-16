# 17: Contribution Entity Names

Status: ready-for-agent
Blocked by: 16
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The client half of spec Q71: staff read names, not raw ids, in the Mentions review tab.

- **Send:** each contribution carries `entityNames` for every entity its clusters, cluster entities and corrections reference, including the persona. Names are the world's names with placeholders resolved, the same resolution the narration uses.
- **Staff tab:** each link shows the entity's name. An item without a name for an id falls back to the id.
- **Changelog:** none (staff tooling).

## Acceptance criteria

- [ ] A contribution from a world whose entity name holds a placeholder sends the resolved name, never the raw token. The test is proved by reinstating the bug.
- [ ] The staff tab shows names, and the id when a name is missing.
- [ ] Frame of the staff tab with names, for the user.
