# 08: Docs for Entity Avatars

Status: ready-for-agent
Blocked by: 03, 04, 05, 06, 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: prose rewrites against landed behavior, following the Writing Guide, plus a help-vector rebuild.

## What to build

The player docs describe per-entity Avatars instead of the **3D Player Avatar** checkbox (spec: Docs and dev routes). Rewrite the Avatars page, the World Editor overview, Starting a Game and the world-format page. Rebuild the help vectors. Update the glossary's **Avatar** entry to "chosen for an entity" and add **User's Default**.

## Acceptance criteria

- [ ] No doc mentions the 3D Player Avatar checkbox or a single world Avatar.
- [ ] The docs cover the world store, the entity dropdown, User's Default and its badge, the one entity view, and the avatar step.
- [ ] Help vectors rebuilt; the build passes.
- [ ] Glossary updated.
