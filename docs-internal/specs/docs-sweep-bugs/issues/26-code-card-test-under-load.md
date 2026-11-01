# 26: Code Card Test Holds Under Load

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one test's assumption about typing speed, with a guard that must keep its bite.

## What to build

`CodeArea.cards.test.tsx`, "builds a card for the shown option only, and one more for each option the author moves to", fails under full-suite load and passes alone. It failed in two full runs on 2026-11-01: this spec's close and a separate run on main.

```
expected Set{ 'return', 'stats', 'Health' } to deeply equal Set{ 'Health' }
```

Likely cause, from reading the test and not yet proven: a slow machine lets a completion list open between typed keys. That list builds the card of its own selected option, so `return` and `stats` get cards. Each card still belongs to a selected option, so the test's assumption about typing speed looks wrong, not the code. Prove this first. If a card is built for an option that was never selected, the bug is in the code, and the code gets the fix.

`npm test` reruns a timeout-only failure alone, but this failure is an assertion, so it stays red.

Evidence: the close commit of this spec; the test's "Every list the keystrokes raised…" comment.

## Acceptance criteria

- [x] The cause is shown by reproducing the failure under load or by slowing the keystrokes, not only by reading the code. `userEvent.setup({ delay: 200 })` gave `Set{ 'Health', 'return', 'self', 'stats' }`; each extra label is the first option of a list that opened between keys. The code is right.
- [ ] The test passes under load, with the machine's real timing, and no fixed sleep or longer timeout carries the fix. The test now types one key, so typing speed cannot raise a second list. It passes alone and in its whole file; no full-suite or CPU-stress run was made.
- [x] The test still fails when the code builds a card for every option in the list (mutation run, restored). `Set{ 'Health', 'Heat', 'Heart', …(2) }`.
- [x] The test still fails when moving to an option builds no card or more than one (mutation run, restored). Two cards: "called 1 times, but got 2 times". No card: "got 0 times".
- [x] No changelog entry, if only the test changes. Only `CodeArea.cards.test.tsx` changed.

## Landed

**Not verified**
- Passes under full-suite load: not run in a full suite, and no CPU stress ran. The fix removes the dependence on typing speed, so the failure has no remaining trigger, but a full run on main is the proof.

**For you**
- Run `npm test` on main once and confirm the code card test stays green.
