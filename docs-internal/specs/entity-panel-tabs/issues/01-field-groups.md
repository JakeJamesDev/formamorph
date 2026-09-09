# 01: Split The Entity Field Body Into Named Groups

Status: in-progress
Base: e16d4a91
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

Prefactor. A mechanical split of one shared component with two hosts; the risk is a missed prop, not design judgment.

## What to build

The shared entity field body stops being one flat stack. It becomes a set of named field groups exported from one place: identity (Name, Aliases, Type), descriptions (the three prose fields with their AI-generate controls), gallery (the image widget), and model (the 3D slot). The World Editor's entity manager and the library character modal both compose their panel from these groups and render exactly what they render today, in the same order, with the same Simple and Advanced gating and the same locations picker behavior. No field is rendered by two components.

## Acceptance criteria

- [ ] Each group is exported once and takes the same value/change/placeholder/owner inputs the body takes today.
- [ ] The World Editor entity panel renders the same labels in the same order in both modes as before the change.
- [ ] The library character modal renders the same labels in the same order as before the change.
- [ ] Every existing World Editor, entity, and library modal test passes unchanged.
- [ ] Four gates green; graph updated.

## Blocked by

- None — can start immediately.
