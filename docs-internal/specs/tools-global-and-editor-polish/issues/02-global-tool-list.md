# 02: Global Tool List With Per-Preset Enabled Bits

Status: ready-for-human
Base: daaa8499
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a type change across the preset store, settings context, offer path, Tools tab, and packs, plus an ADR amendment. Needs the whole picture held at once.

## What to build

A player writes a Tool once. Every user preset lists it, switched off except the preset it was created on. The list row switch turns it on for the preset shown in the tab's preset selector. Deleting a Tool removes its switch from every preset. Copying a preset copies its switches. A request receives a Tool only when the global Tools switch is on, the active preset has the Tool on, and the Tool is offered to that request kind. The Tool's Offered To list and call limit live on the Tool. Tool packs carry definitions only. There is no migration: presets that hold Tools in local storage lose them, and no legacy import branch exists.

## Acceptance criteria

- [ ] The `Tool` type has no `enabled` bit; the preset type has no `tools`; a global user Tool list lives in settings beside the preset store
- [ ] Each user preset holds an enabled map keyed by Tool id, covering catalog and user Tools; a missing key means off
- [ ] Creating a Tool enables it on the active preset only; deleting removes its id from every preset; copying a preset copies the map
- [ ] The offer function returns only Tools enabled on the active preset and offered to the request kind, and nothing when the global switch is off
- [ ] The Tools tab lists every Tool under the selected preset with the row switch bound to that preset's map
- [ ] Packs export and import definitions without an enabled bit
- [ ] ADR-0008's first Decision bullet reads that a Tool is defined once in settings and enabled per prompt preset; the glossary Tool entry matches
- [ ] Pure tests on the store, the offer function, and packs; ToolsTab harness tests for the row switch and delete-from-all; each fails when its behavior is removed
- [ ] The response that lands this ticket says the preset export shape changed
- [ ] Four gates green, `graphify update .` run, In-Progress changelog entry added
