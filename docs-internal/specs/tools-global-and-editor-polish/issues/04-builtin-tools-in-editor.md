# 04: Built-in Tools Open in the Editor

Status: ready-for-human
Status note: landed as 1d834f5e; the in-browser look is unverified (the preview pane did not composite).
Base: 07896101
Blocked by: 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: editor state wiring with one new global override map; the editor tests from ticket 01 are prior art.

## What to build

A player opens a built-in Tool in the same editor as their own Tools. Definition fields, parameters, handler, and empty result are shown locked. Offered To and the call limit are editable. Saving writes a global catalog override keyed by catalog Tool id, holding only those fields. The catalog definition itself never changes. The offer path and the list row summary read the overridden Offered To list.

## Acceptance criteria

- [ ] Edit on a built-in Tool opens the editor with definition fields locked and Offered To editable
- [ ] Saving writes the global catalog override; the catalog constant is unchanged
- [ ] The list row summary and the offer function use the overridden Offered To list
- [ ] Harness tests cover the locked fields, an Offered To edit round trip, and the offer result; each fails when its behavior is removed
- [ ] Four gates green, `graphify update .` run, In-Progress changelog entry added
