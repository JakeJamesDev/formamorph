# 01: Split The Entity Field Body Into Named Groups

Status: ready-for-human
Status note: Done in `2a503266` and `7e949ece`. The acceptance criterion "same labels in the same order" was relaxed for one field: the Type field moves from below the descriptions to the end of the identity group, in both hosts. The user approved the move on 2026-09-09; it is where the spec's Profile tab puts it anyway. Groups exported: `EntityIdentityFields`, `EntityDescriptionFields`, `EntityLocationsField`, `EntityGalleryField`, `EntityModelField`, all taking `EntityFieldGroupProps`. The default `EntityFields` export is now the library modal's stacked composition of those groups.
Base: e16d4a91
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

Prefactor. A mechanical split of one shared component with two hosts; the risk is a missed prop, not design judgment.

## What to build

The shared entity field body stops being one flat stack. It becomes a set of named field groups exported from one place: identity (Name, Aliases, Type), descriptions (the three prose fields with their AI-generate controls), gallery (the image widget), and model (the 3D slot). The World Editor's entity manager and the library character modal both compose their panel from these groups and render exactly what they render today, in the same order, with the same Simple and Advanced gating and the same locations picker behavior. No field is rendered by two components.

## Acceptance criteria

- [x] Each group is exported once and takes the same value/change/placeholder/owner inputs the body takes today.
- [x] The World Editor entity panel renders the same labels in the same order in both modes as before the change.
- [x] The library character modal renders the same labels in the same order as before the change.
- [x] Every existing World Editor, entity, and library modal test passes unchanged.
- [x] Four gates green; graph updated.

## Blocked by

- None — can start immediately.
