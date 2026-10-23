# 08: Docs for Entity Avatars

Status: done
Blocked by: 03, 04, 05, 06, 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: prose rewrites against landed behavior, following the Writing Guide, plus a help-vector rebuild.

## What to build

The player docs describe per-entity Avatars instead of the **3D Player Avatar** checkbox (spec: Docs and dev routes). Rewrite the Avatars page, the World Editor overview, Starting a Game and the world-format page. Rebuild the help vectors. Update the glossary's **Avatar** entry to "chosen for an entity" and add **User's Default**.

## Acceptance criteria

- [x] No doc mentions the 3D Player Avatar checkbox or a single world Avatar. Grep over `docs/*.md` and `CONTEXT.md` finds only changelog history and the legacy-key note in WorldFormat.
- [x] The docs cover the world store, the entity dropdown, User's Default and its badge, the one entity view, and the avatar step.
- [x] Help vectors rebuilt; the build passes. `npm run build:help-vectors` ran twice; typecheck and changed-file lint passed, and prepare runs the build.
- [x] Glossary updated. `CONTEXT.md` and `docs/Glossary.md`.

## Landed

**Not verified**
- Rendered wiki pages: the edits are read against the code labels by a spec review, not viewed.
- Left alone as out of scope: lowercase "avatar" in `docs/Saves-and-Backup.md` and `docs/Community-Creations.md`.

**For you**
- Read the new "World Avatars" and "How to Set Your Default Avatar" sections in `docs/Avatars.md`.
