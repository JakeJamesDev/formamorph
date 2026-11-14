# 06: Open Chat Uses World Options

Status: done
Blocked by: 03, 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Open Chat's Reply Length, Style and Pacing become World Options instead of traits (Q16).

- Each trait group becomes a choice Option; each trait becomes a value with the same placeholder pins. Defaults match today's default picks. Shown to Player and mid-game are on.
- The three trait groups and their traits are removed.
- Old Open Chat saves load with each Option at its default; no save migration (Q21).
- Read and write the world JSON through the `bundled-worlds` skill.
- Changelog fragment.

Spec rulings: Q16, Q21.

## Acceptance criteria

- [x] For every value of every Option, the pinned placeholder text matches what the matching trait pinned before. Node compare of old and new world JSON: 9 of 9 values keep name, id, pins and default; `openChatWorld.test.ts` "changes only its own placeholder" runs each value.
- [x] Open Chat has no traits left from the three groups. `openChatWorld.test.ts` "leaves no traits behind".
- [ ] A save made on the old Open Chat loads and plays with default Options.

For you: a short Open Chat session with each Style to confirm the replies still read right.

## Landed

**Not verified**
- Old-save criterion: only partly proved. `openChatWorld.test.ts` "reads the defaults for a save with no picks or a stale pick" proves missing and stale Option values read the defaults. No test loads a full save envelope that names the removed trait ids. `buildTraitContext` ignores ids the world lacks, by reading.
- `e2e/open-chat.spec.ts`: the three clean-profile tests fail before the world loads, because the v3.7.0 library gate hides Open Chat with an empty library. That is outside this ticket. The Style switch test now drives the World Options tab and did not run.
- `testing/baseline/harness/open-chat-probe.mjs` now reads Options. It did not run; no probe numbers exist.
- The two world-question cases (`chat-entity-leads`, `chat-reply-length`) pass their fact check in `world-question-cases.test.ts`. The model probe for them did not run.

**For you**
- A short Open Chat session with each Style to confirm the replies still read right.
- Open Chat setup: **World Options** shows Reply Length, Style and Pacing, each on its middle value; the in-game **World Options** tab changes them. Read the Style description clause and the two readme lines.

**Added beyond the ticket (spec session rulings)**
- The Formaquestion World Index lists World Options, so the help window still answers Open Chat tone questions. Hidden Options are flagged Hidden.
- `GamePrompts.globalBlocks.test.ts` adds a world trait to Open Chat itself, since no bundled world has a world trait and no persona now.
