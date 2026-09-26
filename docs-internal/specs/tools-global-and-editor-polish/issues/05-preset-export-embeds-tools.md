# 05: Preset Export Embeds Tools, Import Merges by Name

Status: ready-for-human
Status note: landed as 01c67410; the Import dialog's Script Tool warning is covered by jsdom tests, not checked in the browser.
Base: 1d834f5e
Blocked by: 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: pure merge logic with existing pack-plan tests as prior art, plus one import path in the settings context.

## What to build

A player exports a preset and the file carries a copy of every user Tool that preset has switched on. Catalog Tools embed nothing. On import, an embedded Tool whose name is unknown to the global list is added with a fresh id and switched on for the imported preset. An embedded Tool whose name matches a local Tool is dropped, and the imported preset switches the local one on. The local Tool is never replaced.

## Acceptance criteria

- [ ] Preset export embeds a copy of each enabled user Tool and no catalog Tools
- [ ] Import adds unknown names with fresh ids and enables them on the imported preset
- [ ] Import keeps the local Tool on a name collision and enables it on the imported preset
- [ ] Pure tests cover embed, add-unknown, keep-local, and catalog-embeds-nothing; each fails when its behavior is removed
- [ ] The response that lands this ticket says the preset export shape changed
- [ ] Four gates green, `graphify update .` run, In-Progress changelog entry added
