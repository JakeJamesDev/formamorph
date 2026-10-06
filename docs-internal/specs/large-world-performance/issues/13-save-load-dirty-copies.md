# 13: Save, Load and Dirty-Check Copies

Status: ready-for-agent
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

- [ ] Unit: dirty after an edit, clean after reverting it, clean after save, clean after reordering keys or clearing an optional array.
- [ ] Discard restores the last saved world exactly.
- [ ] Harness `typing` step: the heap does not step by world size per keystroke.
- [ ] Harness at 6x: `open` and `save` meet Q1 or the revised bar; editor peak heap through save meets Q8 or the revised bar.
- [ ] Guard bites: making the compare ignore one changed record turns the dirty test red.
- [ ] Four gates green.
