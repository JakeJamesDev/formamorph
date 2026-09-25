# 08: Edit and Try a Tool

Status: ready-for-agent
Blocked by: 02 — Run a Tool Call in the Tool Runner; 03 — Give the Code Editor a Surface and JSON Highlighting; 07 — Show the Tools Tab
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## Parent

[Tool Creator](docs-internal/specs/tool-creator/spec.md)

## What to build

Edit mode for a user Tool. The World Editor's panel tab strip holds Definition, Parameters, Handler and Availability, each with an icon; Try It sits beside the tabs; the footer has Cancel and Save Tool. An open draft survives the full-screen toggle.

Definition: the name is checked against the allowed characters and uniqueness as the player types; the description field guides toward Purpose, Use when, Input and Output and uses the prompt editor with undo and redo. Parameters: add, edit and remove with name, type (text, number, yes/no, one of a list), description and required flag. Handler: pick Lookup (source, parameter, full or summary), Template (chip text in the prompt editor with parameters as chips) or Script (the stat-code editor with a Tool surface listing `args` typed from the parameters, the world and the current scene, with completions, diagnostics and the hint). The empty-result field highlights as JSON. Availability: which prompts offer the Tool, and the per-Tool call limit with the global default shown when blank.

Try It shows one input per parameter, runs the Tool Runner against the open world or the sample world when none is open, and shows the result and the schema the AI receives with JSON highlighting. A script error shows as a readable message.

Model rationale: Opus at high effort for a four-tab form with live validation, two editor integrations, a typed script surface and a draft that must survive a remount.

## Acceptance criteria

- [ ] Each tab edits its fields; Save writes the Tool to the preset; Cancel discards the draft.
- [ ] Name validation blocks save on a bad character, a length outside 1–64, a duplicate or a catalog name.
- [ ] The Script surface lists `args` with the parameter types, the world and the scene; completions and the hint read it.
- [ ] Try It runs the real runner, shows highlighted JSON for result and schema, and shows script errors readably; with no world open it uses the sample world.
- [ ] The draft and the active tab survive the full-screen toggle.
- [ ] Verified in the preview with static DOM evidence, both themes.
- [ ] Component tests cover create, edit, validation, each handler kind, Try It and the full-screen round trip; four gates green.
