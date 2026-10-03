# 49: Screen how-tos only on "here" questions

Status: done
Status note: Built and measured. Task recall@5 over an open screen rises 4–10 points on three screens and both sets; "here" stays at 100%. The answer probe was skipped by ruling.
Base: d0255691
Blocked by: 47
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A task question asked over an open screen keeps room for its own sections (Q78). In the app, every question has an open screen. Ticket 47 measured task recall@5 over an open screen at 54–62%, against 79% with no screen. The screen's section and its page's how-tos (ticket 32) take up to three of the five slots.

- The screen's page how-tos join the docs block only when the question says "here", "this" or "these", the same gate as Q77.
- The screen's section still leads every question.
- "How do I add one here?" still gets the screen's how-to; ticket 32's test still passes.

**Probe.** The recall probe with its screen option, over the same three screens as ticket 47, on both sets; and ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control.

Recommended model rationale: one gate, but it must not undo ticket 32's "here" gain.

## Acceptance criteria

- [x] A task question with no here/this/these over an open screen gets no on-page how-to; a test asserts it
- [x] "How do I add one here?" still gets the screen's how-to; a test asserts it
- [x] Task recall@5 over an open screen rises on both sets; "here" grounded-correct stays within the 5-point drift; same batch. "Here" holds by construction, so the answer probe did not run (spec session ruling, below)
- [x] Four gates green

## Handover

**Result: task recall@5 over an open screen rises on all three screens and both sets, by 4 to 10 points. "Here" recall@5 stays at 100%.**

**The rule (Q78).** `helpSections` adds the lead page's how-tos (ticket 32) only when the question says "here", "this" or "these". It uses `POINTS_AT_SCREEN`, the same word list as Q77. The screen's section still leads every block.

- `howToRule: false` on a question, or on `helpSections`, adds the page how-tos to every question. It exists for tests and the probes' control arm, like `screenRule`.
- Only the question's own words count. A follow-up's earlier question does not.

**Recall probe.** Ticket 39's probe, both sets, default cloud endpoint, model `default`, 3 runs per screen, the same three screens as ticket 47. `npm run probe:help-recall -- --ai --arms keyword,shipped,howto-old --runs 3 --screen <screen>`. `howto-old` is the build before this ticket, in the same batch. 0 failed pick requests and 0 failed first answers in every run. Raw rows (not tracked): `help-recall-2026-10-02T19-53-23-191Z` (library), `…T20-00-22-992Z` (stats), `…T20-06-28-227Z` (game).

| Asked over | Set | Keyword: task @5 | Rule: task @5 | Before: task @5 | Rule: here @5 | Before: here @5 |
|---|---|---|---|---|---|---|
| Main Menu, Worlds tab | Known | 64.0% | **66.7%** | 60.4% | 100% | 100% |
| Main Menu, Worlds tab | Blind | 67.9% | **77.4%** | 70.6% | – | – |
| World Editor, Stats tab | Known | 64.0% | **56.0%** | 51.6% | 100% | 100% |
| World Editor, Stats tab | Blind | 67.9% | **68.7%** | 58.3% | – | – |
| Game screen, Memory tab | Known | 64.0% | **64.4%** | 57.3% | 100% | 100% |
| Game screen, Memory tab | Blind | 67.9% | **71.8%** | 64.7% | – | – |

- The before arm matches ticket 47's rule arm within drift: 60.4% vs 60.0%, 51.6% vs 53.8%, 57.3% vs 58.7% on the known set.
- The keyword arm runs through the shipped block builder, so it has the rule too. It was 45.3–56.0% on the known set in ticket 47.
- With no screen open the rule cannot fire (no lead), so those rows are ticket 47's: 78.9% known, 86.7% blind.
- Follow-ups rise or hold too (known: 86.7% vs 73.3%, 70.0% vs 63.3%, 76.7% vs 76.7%). Each arm's first answers use that arm's rule, so these carry first-answer drift.

**Answer probe: not run, by the spec session's ruling (option A).** Both arms send the same blocks for every case of ticket 26's set, apart from pick drift:

- All 12 "here" questions say "here", "this" or "these", so the page how-tos join as before.
- No task, follow-up, language, changelog or not-covered case has a screen, so no case gets page how-tos in either arm.

So a run would measure only drift. The answer probe has the arm for later use: `--howto-old`.

**Tests.**

- `helpSession.test.ts`, "the how-tos of the open page": the how-tos join under the score floor for "here", "this" and "these"; they stay out for no word, "where" and "thistle"; `howToRule: false` adds them.
- `helpSession.surface.test.ts`, "the how-to of the open page", through `askHelp` over the Locations tab: "How do I add one here?" gets `How to Add a Location`; "How do I add one?" does not, and keeps four of its own hits; `howToRule: false` adds it back. Ticket 32's bundled-docs test still passes.
- Five mutations each turned the right tests red, and each restore was checked with `cmp`: always add, never add, the override ignored, no word bounds, the override not passed through `askHelp`.

**Seen, not fixed.**

- **Over the Stats tab, the picks still cost task recall.** Known tasks: keyword 64.0%, with picks 56.0%. Ticket 47 saw the same. On the blind set the picks gain under one point there.
- **Task recall over a screen is still under the no-screen numbers** (56–67% vs 79% known). The screen's section takes one of five slots for every question.

**Review** (`/mattpocock-skills:code-review d0255691`, this commit only). Folded in:

- `howToRule` has one TSDoc, on `HelpQuestion`; `helpSections` takes its type from there.
- `wantsPage` is now `addsPageHowTos`.
- The bare `false` in the recall probe's `queriesOf` has a comment.

Left as is:

- The arm flags spread over several places in both probes. Ticket 47 left the same pattern; a table from arm to rule overrides would collapse it.
- The Q78 row in `spec.md` does not record the answer-probe ruling. The spec session folds rulings in.

**Gates**, after the review fold-in: typecheck exit 0 (19 s), lint exit 0 (18 s, 2 warnings in files this ticket does not touch), test exit 0 (16,521 passed, 3 skipped, 131 s), build exit 0 (20 s). `testing/` is outside `tsconfig.json`, so the two probe files were checked with a scratch config: exit 0.
