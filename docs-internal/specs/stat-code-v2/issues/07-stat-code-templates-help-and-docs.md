# 07: Stat Code Templates, Help, And Docs

Status: ready-for-agent
Blocked by: 03, 05, 06
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Authoring surface only: templates, help copy, the wiki page, the Test Bench check, and the changelog. The mechanics are done by the time this starts. Sonnet at medium effort suits copy and template work with a test gate.

## What to build

An author opening the Code tab finds templates for the three new powers: a bounds write, a placeholder write, and a trait switch. The help text beside the code editor describes `self`, the turn inputs, `placeholders`, and `traits` in the plain-voice style the panels use. The wiki's stat code page documents the full surface with one short example per power. The Test Bench's stat code check runs every stat's code under the new surface and reports the same findings it does today, plus writes to unknown names. The changelog gains one In-Progress entry for the feature.

## Acceptance criteria

- [ ] Templates exist for a bounds write, a placeholder write, and a trait switch, and each parses and runs
- [ ] Help text describes the full surface and follows the settings copy layers (brief line, ⓘ tip)
- [ ] The wiki stat code page covers `self`, the turn inputs, `placeholders`, and `traits`, with no version pinned
- [ ] Test Bench stat code check passes on the default worlds and reports unknown-name writes
- [ ] Changelog In-Progress entry added in the 👤 bucket
- [ ] Template tests cover the three new templates
- [ ] Four gates green; graph updated

## Blocked by

- 03 — Stat Code Sets Its Own Bounds
- 05 — Stat Code Writes Placeholders
- 06 — Stat Code Reads And Switches Traits
