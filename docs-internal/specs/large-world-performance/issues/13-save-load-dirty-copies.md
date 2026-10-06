# 13: Save, Load and Dirty-Check Copies

Status: ready-for-human
Blocked by: 01, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: reworks dirty tracking and discard in the data provider; the Q8 memory ticket, and "unsaved changes" correctness is user-visible.

## What to build

Editing, saving and loading make far fewer whole-world copies (Q8). The dirty check compares only records whose identity changed since the last commit against the saved baseline; no whole-world string is built per edit. The saved baseline is one structure, not a snapshot string plus a parsed copy plus a canonical string. Discard rebuilds from it. Load and save each make at most one full copy beyond the live world. The canonical rules stay: key order and emptied optional fields don't count as changes.

Ticket 01 found no floor, so Q1 and Q8 stand. Its findings set two requirements here:

- The open editor holds the world about 5x: live, the snapshot string, the canonical string, and ~355 MB of dirty-check string cache. Remove all three extras. After a save, stale closures also keep a second generation alive (~970 MB of serialized strings, measured at the save point); remove that too.
- A bare put blocks 0.76 s at 6x, but the store's read-then-put blocks 1.1 s in one task. Drop the full-record read on save; read the sticky fields from ticket 05's metadata store. Report `npm run profile:editor-speed` steps before and after at 6x in the ticket (Q7).

## Acceptance criteria

- [x] Unit: dirty after an edit, clean after reverting it, clean after save, clean after reordering keys or clearing an optional array.
- [x] Discard restores the last saved world exactly.
- [ ] Harness `typing` step: the heap does not step by world size per keystroke. **Moved to ticket 14** (spec session ruling, 2026-10-06): the remaining rise is the Test Bench's `measureJsonBytes`, not a dirty-check copy.
- [x] Harness at 6x: `save` meets Q1; editor peak heap through save meets Q8. `open` misses Q1 and **moved to ticket 14** (same ruling): its block is the Test Bench rules on mount and React mount, not the load path.
- [x] Guard bites: making the compare ignore one changed record turns the dirty test red.
- [x] Four gates green.

## Results

Measured 2026-10-06, production build, 6x CPU, bench world. Before is base `1173fb81` with this branch's harness; after is this branch.

| Step | Before | After |
|---|---|---|
| Open: worst block | 2.4 s | 2.2 s |
| Open: heap after GC | 824 MB | 214 MB |
| Typing: latency p50 / p95 | 1528 / 21024 ms | 920 / 1128 ms (quiet); 1208 / 22408 ms (loaded) |
| Typing: worst block | 21.2 s | 1.1 s (quiet); 22.3 s (loaded) |
| Typing: heap start → sampled peak | 877 → 2607 MB | 267 → 868 MB |
| Typing: heap after GC | 1206 MB | 280 MB |
| Save: wall time / worst block | 5.0 s / 2.7 s | 1.1 s / 0.82 s |
| Save: heap start → sampled peak | 1206 → 2360 MB | 240 → 375 MB |
| Save: heap after GC | 1352 MB | 240 MB |
| Tree drag: frame p95 / max, worst block | 683 / 3483 ms, 3.3 s | 567 / 1917 ms, 1.8 s |
| Canvas: worst block | 0.54 s | 0.28 s |
| Canvas drag: frame p95 / max | 250 / 900 ms | 150 / 467 ms |
| Bare `put` / `get` worst block | 0.92 / 0.38 s | 0.84 / 0.34 s |

The tree, canvas and `idb` before numbers come from a run on a loaded machine (its `open` blocked 13 s), so read them as an upper bound. This ticket doesn't change those steps.

- The saved baseline is one world object that shares every unedited record with the live world. The dirty check compares by identity first and builds no string. The snapshot string, the canonical string and the canonical cache are gone, and so is the second generation after save.
- `storeWorld` already read only the metadata record (ticket 05), so save is now the bare `put`.
- **Harness fix:** in Advanced mode, the `typing` step typed into the Aliases chip input, which never commits. It now types into the Name field. Ticket 01's typing row measured no edit. `typing` and `save` now also report a heap peak sampled without GC.
- **Finding:** typing 26 keys into Name blocks up to 21–22 s per key at both base and this branch, on a loaded machine (26 s total and 1.1 s worst on a quiet run). The CPU profile shows tree-row and tooltip re-render (ticket 11) and the Test Bench rules after each pause, with `measureJsonBytes` serializing the whole world (ticket 14). No dirty-check frame appears.
