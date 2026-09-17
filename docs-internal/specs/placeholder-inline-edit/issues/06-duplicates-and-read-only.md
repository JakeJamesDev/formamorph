# 06: Duplicates and Read-Only Cases

Status: ready-for-human
Base: 2530b8df
Blocked by: 03, 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high
Type: task
Spec: ../spec.md (Duplicates; Which value opens)

Model rationale: replacing a slot's content while another copy holds the caret is the stale-caret bug class the prototype hit.

## What to build

A field that places the same placeholder more than once behaves predictably on the Values tab, and values
the author cannot edit open as read-only text.

- Placements that show the same value id open once. The first in document order is editable; every later
  one is a read-only mirror that re-renders from the store as the editable copy writes.
- Unique placements with different rolled values hold different value ids, so each is its own editable slot.
- A chevron step re-evaluates which copy is editable. A copy that holds the caret is never replaced under it.
- A mirror carries the same header and outline as an editable value, with a clear read-only look.
- A read-only field shows the Values tab with slots that accept no input.
- A pin whose value is typed off the list has no value id. It opens as read-only text.

## Acceptance criteria

- [ ] Two World placements of one placeholder open one editable slot and one mirror.
- [ ] Typing in the editable copy updates the mirror live.
- [ ] Two Unique placements with different rolls open two editable slots that write to different values.
- [ ] Stepping one Unique placement onto the other's value turns the later one into a mirror without losing the caret.
- [ ] A read-only field's slots accept no typing and show no caret indicator.
- [ ] An off-list pinned value opens read-only.
- [ ] Component tests cover mirror, live update, Unique independence, read-only field, off-list pin.
- [ ] Changelog In-Progress entry added. Four gates green.
