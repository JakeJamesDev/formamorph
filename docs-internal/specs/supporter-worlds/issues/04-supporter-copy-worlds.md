# 04: Client: Supporter Copy rule on worlds

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: one pure rule threaded through many surfaces (Main Menu, World Editor, Media tab, backup, crash export); a missed one is a leak.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

A world record can carry a local-only Supporter Copy marker (listing id, account id, revision), kept like `sourceId` and never part of world data. One pure function answers whether an action is allowed on a world: world export, entity card export, dictionary export, Duplicate, Publish, media Download, backup, crash-recovery export, Save to Library (R7). This ticket owns the marker type and the function; tickets 05 and 06 import them. Every world surface reads the function: blocked buttons show disabled with a tooltip, and the world card shows a Supporter badge (R14). The backup bundle and the crash-recovery export leave Supporter Copies out (R15). Check whether a save export carries world media; if it does, message the spec session.

## Acceptance criteria

- [ ] The rule function is tested for every action on a Supporter Copy and on a plain world.
- [ ] On a fixture Supporter Copy, world export, entity card export, dictionary export, Duplicate, Publish and Media tab Download are disabled with a tooltip in the Main Menu and the World Editor.
- [ ] The world card shows the Supporter badge only on a Supporter Copy.
- [ ] The backup bundle and the crash-recovery export omit a Supporter Copy and keep plain worlds.
- [ ] The marker survives a World Editor save and never appears in an exported world.
- [ ] Save export is checked for world media, and the finding is stated in the landing.
- [ ] Each guard is shown to bite by reinstating the bug.
- [ ] Frames `.scratch/frames/supporter-copy-menu.png` and `.scratch/frames/supporter-copy-editor.png`, light and dark, at a desktop width.

For you: read the tooltip and badge copy in the Main Menu.
