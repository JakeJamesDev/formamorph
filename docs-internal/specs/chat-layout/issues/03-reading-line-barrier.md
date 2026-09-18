# 03: Reading-Line Barrier Drives the Panels

Status: ready-for-human
Base: 6f7bd1ec
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: `docs-internal/specs/chat-layout/spec.md`

## What to build

In Chat, the turn that crosses a reading line 30% down the viewport is the viewed turn. Stats, notes, and
the other turn panels show the viewed turn, and the "Viewing turn N of M" banner shows in its current place.
The barrier writes the same "user page" state that the Pager writes, so every panel derivation stays as it
is.

## Acceptance criteria

- [x] The viewed-turn rule is a pure function: the turn that crosses the line; the latest turn when the list is at the bottom; the nearest turn above when no turn crosses. Unit tests cover each case and two short turns in view.
- [x] The scroll handler runs the rule one time for each animation frame and writes the user page only when the viewed turn changes. At the latest turn it writes "follow latest".
- [x] Stat bars snap while the player scrolls through history. They still animate on submit.
- [x] The notes tab shows and edits the notes of the viewed turn, as in Pages.
- [x] A submit acts on the latest turn no matter where the player scrolled. A harness test guards this.
- [x] A change of layout during a game keeps the viewed turn in both directions.
- [x] Playwright covers: over a wheel scroll through history, the banner's turn matches the turn on the reading line at every step.
- [x] Each new guard is proven once by reinstating the bug it guards. Four gates green.

## Comments

- **Snap covers the whole stat row.** The delta chip and the band flash snap with the bar. A fast scroll
  would queue them the same way. Each row remembers the state it first showed under a scroll, so a return to
  the latest turn stays still. A submit, a drain, and Re-generate Stats still animate.
- **Pages to Chat opens on the viewed turn.** Chat puts that turn's top on the reading line. A turn that
  cannot reach the line, near the end of a short list, stays viewed until the player scrolls. The open aim's
  scrolls never count as player scrolls.
- **Notes have no Chat-only test.** The notes tab reads the same user page that the barrier writes, so the
  Pages notes tests cover it.
- **Follow-up (not built):** the barrier runs on scroll events only. A resize, or a rollback that leaves the
  offset where it is, keeps the panels on the old turn until the next scroll.
- Guards proven by reinstating each bug: the at-bottom rule, the nearest-turn-above rule, the barrier
  write, Send locked while reading history, the stat snap (both the rule and the per-row memory), the
  reading-line share, the open aim on the viewed turn, and open-aim scrolls counted as player scrolls.
- e2e: `e2e/chat-barrier.spec.ts`, 4 cases, desktop only, about 45 s.
