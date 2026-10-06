# 07: Community Desktop Rail And Header

Status: done
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: restructures the Community browser's desktop layout around the rail and moves its tutorial anchor; the browser is a large view with many tests.

## What to build

On desktop Community Creations' whole header spans the window as one block with one bottom border and 12px sides: the title row, the filter bar and the contest banner (Q12). The title row reads back and title, the search box filling the free space, the quarantine control, then the sort select, the order toggle and refresh, with refresh last (Q32).

Below the header the Nav Rail is the first column beside the results and the pager (Q18). Its groups are Worlds, Entities, Dictionaries, Avatars, then Prompts, then Contest while a contest exists (Q19). It replaces the labeled landscape column and its solid active style. The section tutorial anchors on the rail. Changelog fragment: the lead **The World Editor and Community Creations move their sections to a collapsible side rail.** and a sentence on Community's rail.

From the prototype branch `prototype/world-editor-tabs` (final commit `dbe3c035`, Community header `54a3e233`); launch entry `proto-world-editor-tabs`, port 5245.

## Acceptance criteria

- [ ] The title row, filter bar and banner span the window; the rail starts below them.
- [ ] The header's right-hand order is sort select, order toggle, refresh.
- [ ] Picking a rail tab switches the section; Contest appears only while a contest exists.
- [ ] The rail starts expanded and remembers its own state, apart from the editor's.
- [ ] The section tutorial anchors on the rail.
- [ ] Existing Community switcher and tutorial tests pass, retargeted where they named the old column.
- [ ] Changelog fragment written.
- [ ] Gates green.

## Blocked by

- 02, 03
