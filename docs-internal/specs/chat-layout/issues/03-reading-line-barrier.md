# 03: Reading-Line Barrier Drives the Panels

Status: ready-for-agent
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

- [ ] The viewed-turn rule is a pure function: the turn that crosses the line; the latest turn when the list is at the bottom; the nearest turn above when no turn crosses. Unit tests cover each case and two short turns in view.
- [ ] The scroll handler runs the rule one time for each animation frame and writes the user page only when the viewed turn changes. At the latest turn it writes "follow latest".
- [ ] Stat bars snap while the player scrolls through history. They still animate on submit.
- [ ] The notes tab shows and edits the notes of the viewed turn, as in Pages.
- [ ] A submit acts on the latest turn no matter where the player scrolled. A harness test guards this.
- [ ] A change of layout during a game keeps the viewed turn in both directions.
- [ ] Playwright covers: over a wheel scroll through history, the banner's turn matches the turn on the reading line at every step.
- [ ] Each new guard is proven once by reinstating the bug it guards. Four gates green.
