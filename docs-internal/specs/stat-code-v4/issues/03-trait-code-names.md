# 03: Trait Code Names

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

The stat code-name function already exists; this applies it to traits at the same surfaces. Narrow and precedented, so Sonnet at medium effort.

## What to build

A trait whose name carries a placeholder chip has one code name across playthroughs: the authored name with each chip replaced by the placeholder's own name, the same rule stats follow. The sandbox keys `traits` on it, and completions, diagnostics, the Test Bench, Test Code, and the rename offer all read it from the same function that names stats. The play site stops resolving trait names before the run; the resolved text stays in use for prompts and the panel. A chip-free trait name is its own code name, so nothing changes for the common case.

## Acceptance criteria

- [ ] For an authored `{{Beast}} Fury`, `traits["Beast Fury"]` reads the trait in two saves that rolled different values
- [ ] Completions offer `Beast Fury`; the editor underlines `traits["Wolf Fury"]`; the Test Bench reports it
- [ ] Test Code runs under trait code names
- [ ] The rename offer compares trait names as code names, so a chip-bearing trait rename offers
- [ ] A chip-free trait name is unchanged on every surface; the trait switch log still shows the resolved text
- [ ] The code-name drift guard covers a chip-bearing trait fixture
- [ ] Four gates green; graph updated

## Blocked by

- None (can start immediately)
