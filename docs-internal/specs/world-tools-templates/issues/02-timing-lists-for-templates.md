# 02: Timing Lists For Templates

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a shipped export-shape change with two migrations, and a filter every template menu reads.

## What to build

A template gains `kind` (Script or World Tool) and a `timings` list in place of `timing` (Q3, Q5, Q10). Template packs move to version 2 and write only the new fields. Import reads v1 and v2. The IndexedDB library migrates a stored v1 row on read, idempotently (Q9). The menu filter takes a kind and a timing. Each stat script box passes its own timing, so At Game Start, During AI Output and When a Trait Switches no longer fall back to the After menu. The fold stays for the test clock. The existing built-ins get the timings in the spec's table. The template editor's Timing field becomes the existing multi-select, limited to the kind's timings, and defaults to the opening box (Q11). A template's detail names every timing it runs in. The Scripts guide's template section says which templates each timing's menu shows.

The runs-clean test starts here: each built-in, filled with its slot defaults, runs without error at each timing it lists and changes something.

Spec: Q3, Q5, Q9, Q10, Q11; stories 10, 14–16, 22, 24–27.

## Acceptance criteria

- [ ] A v1 pack and a stored v1 row come back as `script` with `['before']` or `['after']`; a v2 pack round-trips through export and import
- [ ] The Start, Output and Switch menus no longer list Hourly Change or Regen Toward Target; Weighted Blend shows in Before, After, Start and Switch
- [ ] Saving a template with two timings lists it in both menus
- [ ] The runs-clean test fails when Hourly Change is tagged Start again
- [ ] Export-shape reminder in the landing response; Scripts guide updated
- [ ] Changelog fragment written; four gates green
