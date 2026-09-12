# 03: Trait Code Names

Status: ready-for-human
Status note: Implemented in "Give Every Trait One Stable Code Name". Four gates green; the code-review fixes are folded into that same commit.
Base: 9f53696b
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

The stat code-name function already exists; this applies it to traits at the same surfaces. Narrow and precedented, so Sonnet at medium effort.

## What to build

A trait whose name carries a placeholder chip has one code name across playthroughs: the authored name with each chip replaced by the placeholder's own name, the same rule stats follow. The sandbox keys `traits` on it, and completions, diagnostics, the Test Bench, Test Code, and the rename offer all read it from the same function that names stats. The play site stops resolving trait names before the run; the resolved text stays in use for prompts and the panel. A chip-free trait name is its own code name, so nothing changes for the common case.

## Acceptance criteria

- [x] For an authored `{{Beast}} Fury`, `traits["Beast Fury"]` reads the trait in two saves that rolled different values
- [x] Completions offer `Beast Fury`; the editor underlines `traits["Wolf Fury"]`; the Test Bench reports it
- [x] Test Code runs under trait code names
- [x] The rename offer compares trait names as code names, so a chip-bearing trait rename offers
- [x] A chip-free trait name is unchanged on every surface; the trait switch log still shows the resolved text
- [x] The code-name drift guard covers a chip-bearing trait fixture
- [x] Four gates green; graph updated

## Blocked by

- None (can start immediately)

## Comments

**2026-09-12 — implemented.**

`sandboxTraits` names each entry through `statCodeName`, the function that names stats. `StatCodeTraits.nameOf` is gone; it served the sandbox and the log at once. The turn now takes a required `traitNameOf` for the switch log alone, beside `statNameOf`.

One thing the ticket did not name, found by the closing review: the rename offer has two entry points, and find-and-replace answered only `stats` in its per-root branch. A replace inside a chip-bearing trait name offered nothing. `codeNameReader` in `statCodeRename.ts` is now the single producer of that branch, table-tested over every root.

The trait panel's rename wiring also gets its own test. The stat panel's equivalent prop (shipped in v3 ticket 10) still has none, so a dropped `codeNameOf` there is invisible. Worth a follow-up ticket if anyone wants the pair symmetrical.
