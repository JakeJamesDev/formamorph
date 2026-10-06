# 13: Save, Load and Dirty-Check Copies

Status: ready-for-agent
Blocked by: 01, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: reworks dirty tracking and discard in the data provider; the Q8 memory ticket, and "unsaved changes" correctness is user-visible.

## What to build

Editing, saving and loading make far fewer whole-world copies (Q8). The dirty check compares only records whose identity changed since the last commit against the saved baseline; no whole-world string is built per edit. The saved baseline is one structure, not a snapshot string plus a parsed copy plus a canonical string. Discard rebuilds from it. Load and save each make at most one full copy beyond the live world. The canonical rules stay: key order and emptied optional fields don't count as changes.

Targets come from ticket 01's findings; if 01 showed a floor, follow the spec's revised bar. Report `npm run profile:editor-speed` steps before and after at 6x in the ticket (Q7).

## Acceptance criteria

- [ ] Unit: dirty after an edit, clean after reverting it, clean after save, clean after reordering keys or clearing an optional array.
- [ ] Discard restores the last saved world exactly.
- [ ] Harness `typing` step: the heap does not step by world size per keystroke.
- [ ] Harness at 6x: `open` and `save` meet Q1 or the revised bar; editor peak heap through save meets Q8 or the revised bar.
- [ ] Guard bites: making the compare ignore one changed record turns the dirty test red.
- [ ] Four gates green.
