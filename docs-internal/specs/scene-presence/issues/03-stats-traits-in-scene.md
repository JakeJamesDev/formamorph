# 03: Stats and Traits Follow In Scene

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The stat picker and the Traits tab's owner nodes both read **In Scene**. The stat picker's "absent" group goes away, along with its own history-based "ever revealed" rebuild. The player's own node and library owners stay in the Traits tab.

## Acceptance criteria

- [ ] The stat picker offers only In Scene entities, strangers by label.
- [ ] The Traits tab shows owner nodes only for In Scene entities, plus the player and library owners.
- [ ] An unmet owner's traits never show.
- [ ] The stat picker's history rebuild is removed, and nothing else reads it.
