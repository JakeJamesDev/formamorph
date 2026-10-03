# 52: Questions that never reach the page

Status: done
Status note: Two of the eight fixed by three keyword lines (Q81); blind recall@5 86.0% → 89.4%, same batch. The other six are pick misses; no pick change held the blind set.
Base: 44724f1d
Blocked by: 50
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Player words reach the right page (Q79). In ticket 46, eight questions never reached the keyed page in 10 runs: `library-2` ("make its box bigger"), `personas-1`, `follow-default-make`, `entities-2`, `tools-2`, `world-editor-placeholders-2`, `worldformat-2`, `worldformat-3`.

- For each, find why neither the keyword search nor the AI pick reached the page.
- Fix the cause in the word map, the pick request or the docs. A word-map line must be a player word for that feature, written as ticket 43 did. Do not write lines from these eight questions' wording.
- A docs gap, where no section answers the question, is fixed in the docs page that owns the feature.
- Check every change on ticket 39's blind set.

**Probe.** Ticket 39's recall probe on both sets, shipped defaults, 5 runs. Ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control.

Recommended model rationale: eight fixes that must generalize past the questions that found them.

## Acceptance criteria

- [x] Each of the eight has a named cause in the handover: word map, pick, or docs gap
- [x] No keyword line copies a known question's wording (a core term is allowed, Q81)
- [x] Blind-set recall@5 does not drop; same batch
- [x] Probe numbers on all kinds, fixed vs current build, same batch, are in the handover
- [x] Four gates green

## Handover

**Verdict: two of the eight fixed, by three keyword lines.** `tools-2` and `worldformat-2` now get the keyed section in 5 of 5 runs. Blind recall@5 rose from 86.0% to 89.4% in the same batch. The other six are not fixed. In each, the AI picks choose another page or other sections, and two have a second cause: a stem (`world-editor-placeholders-2`) and the merge (`worldformat-3`). No pick-request change I measured held the blind set. Six open misses is a partial result for the spec session to rule on.

### Causes

Two sources rank the sections: the keyword search and the AI picks. I traced each question through both, with 2 to 3 cached pick replies each. The picks choose a page, then often copy its first lines in list order (ticket 50).

| Question | Keyword rank of the keyed section | What the picks chose | Cause |
|---|---|---|---|
| `tools-2` | 5th, 3 of 11 words | Connect-Your-Own-AI endpoint sections | **Word map.** The section's line had no "function calling" or "tool calling", the standard terms for the feature |
| `worldformat-2` | 11th, 5 of 10 words | WorldFormat lines written under the wrong page title ("World Editor ›"), so no line was read in 3 of 3 cached replies | **Word map.** The heading says "Older", and Porter does not stem "older" to "old". The line had "outdated", not "old" |
| `world-editor-placeholders-2` | 22nd, 4 of 10 words | Memory or Entities sections | **Word map, then pick.** The roll section had no "random". The new "random" does not reach this question: Porter stems "randomly" to "randomli". The picks never choose the Placeholders page |
| `library-2` | 139th, 2 of 13 words | World-Editor-Overview list columns and Openings cards | **Pick.** The model reads the main screen's tiles as the World Editor's lists. The line already holds "bigger". The long sections that rank first match 6 to 9 everyday words (ticket 50's coverage cause) |
| `personas-1` | 7th, 4 of 12 words, all from its line | Starting-a-Game trait and location how-tos | **Pick.** The model reads "the one I play" as a starting choice, not a persona |
| `follow-default-make` | 14th | Not traced (a follow-up pick needs the first answer) | **Pick, from its first question.** The answer to `personas-1` gives trait steps, so the follow-up stays on starting choices. The keyword search does not recover it: with a Personas answer in the history, it still ranks `Library#how-to-make-a-group` first ("create folder"). Fixing `personas-1` alone may not fix this one |
| `entities-2` | 40th, 3 of 11 words | Avatars sections | **Pick.** The model reads a character in the library as an Avatar |
| `worldformat-3` | 3rd, 6 of 11 words | World-Editor-Traits how-tos | **Pick.** The picks name editor sections, and their low keyword ranks add to them in the merge. Keyword #3 drops out, as `statcodeguide-2` did in ticket 50. Ticket 50's floor rule would fix this one; Q80 keeps it out |

No question has a docs gap: each keyed section answers its question.

### What changed

Three keyword lines, under Q81 (a standard term that names the feature is allowed; question phrases stay banned). All three were found through the known set.

| Section | Added |
|---|---|
| `Tools#endpoints-without-tool-support` | tool calling, function calling, tool use |
| `World-Editor-Placeholders#the-roll-stays-for-the-playthrough` | random |
| `WorldFormat#versions-and-older-files` | old version, old file |

No phrase of a known question is in a line. "box", "main screen", "same guy", "my collection", "old release" and "randomly" stay out. The existing changelog line on player words covers this, so the changelog did not change.

### Measured alternatives (not shipped)

Offline: cached pick replies, 2 runs per task question, task recall@5 known / blind. The current build is 79.3% / 85.7%.

| Tried | Known | Blind | Of the eight |
|---|---|---|---|
| Page line + the page's first sentence in the pick list | 81.3% | 85.7% | none |
| Page line + the page's keyword phrases in the pick list | 84.7% | **82.7%** | `personas-1` only |
| A reply line under a wrong page title read by its last heading | 79.3% | 85.7% | none live |
| The page's keyword phrases as trail words for every section | 82.0% | 85.7% | none |
| **The three lines (shipped)** | **82.0%** | **88.1%** | `tools-2`, `worldformat-2` |

With the same picks, the three lines changed 4 questions, all up: known `tools-2` and `worldformat-2`, blind `tools-b2` and `placeholders-b3`. The blind set's question text stayed unread; only ids and hit counts were printed.

### Probes

The lines do not change the pick request, because keyword lines are not in the pick list. The control is a second process that serves the three pages from the base commit through a Vite plugin. It ran at the same time as the fixed process, against the same endpoint. The plugin and the scripts stay on this machine at `.scratch/t52/` (not tracked).

**Keyword source only**, `npm run probe:help-recall -- --arms keyword`, 27 s each:

| Arm | Known recall@5 | Blind recall@5 |
|---|---|---|
| Current build | 69.1% | 71.3% |
| Three lines | 70.1% | 72.3% |

**Recall probe, live.** `npm run probe:help-recall -- --ai --arms shipped --runs 5`, no screen, default cloud model, 0 failed requests and 0 empty replies in each arm. Fixed 1,355 s, control 1,368 s. Raw (not tracked): `testing/baseline/runs/help-recall-2026-10-03T00-07-00-411Z` (fixed) and `…T00-07-14-231Z` (control).

| Arm | Known recall@5 | Known task @5 | Known follow-up @5 | Blind recall@5 (run range) | Blind task @5 | Blind follow-up @5 |
|---|---|---|---|---|---|---|
| Current build | 83.7% | 80.3% | 90.0% | 86.0% (85.1–87.2%) | 85.5% | 90.0% |
| Three lines | 85.8% | 82.9% | 90.0% | **89.4%** (88.3–90.4%) | 89.3% | 90.0% |

"Here" recall@5 is 100% in both. The run ranges of the blind set do not overlap.

**Ticket 26's harness, live.** `npm run probe:help -- --runs 5`, `BASELINE_NO_WATCH=1`, 125 questions × 2 arms (retrieval, no-docs) × 5 runs per process, 0 failed. Fixed 2,525 s, control 2,482 s. Raw (not tracked): `testing/baseline/runs/help-baseline-2026-10-03T00-26-27-871Z.json` (fixed) and `…T00-25-44-792Z.json` (control). Grounded-correct by the harness's `scoreAnswer`, counted to one decimal:

| Kind | Current build | Three lines |
|---|---|---|
| Task | 73.6% (276/375) | 74.4% (279/375) |
| Here | 95.0% (57/60) | 93.3% (56/60) |
| Follow-up | 80.0% (40/50) | 82.0% (41/50) |
| **Bar (all three)** | **76.9%** (373/485) | **77.5%** (376/485) |
| Language, setting only (report) | 98% | 100% |
| Language, asked in it (report) | 90% | 88% |
| Changelog (report) | 100% | 100% |
| Not covered, missed flag (report) | 10% | 10% |
| All 625 answers (report) | 80% | 80% |

- Keyed section sent, 5 runs: `tools-2` 0 → 5 (correct 0 → 4), `worldformat-2` 0 → 5 (correct 0 → 5). The other six stay at 0 correct in both arms.
- The 9 gained answers are partly offset by drift elsewhere, so the bar moves 0.6 points. "Here" lost one answer, within drift.
- The rows marked "report" are the harness's rounded rates; the others are counted with `scoreAnswer` against the fixed docs. The two docs differ only in three hidden keyword lines.
- The fixed report lists one "docs gap" first cause. It is `tools-2`: 4 of 5 correct, and its one failed run carries the general-knowledge flag. The section answers the question.
- The placeholders line does not fix `world-editor-placeholders-2`. It stays for its blind gain (`placeholders-b3`), as Q79 allows a stated rule checked on the blind set. The review dropped "random roll" from it: "roll" is in the heading already, so the search terms and the numbers above do not change.
- No-docs control: keys met 1% in both processes.

### Gates

typecheck exit 0 (18 s), lint exit 0 (21 s, 2 warnings in files this ticket does not touch), test exit 0 (129 s, 16,633 passed), build exit 0 (22 s). The docs tests alone: 155 passed.

### Review

`/mattpocock-skills:code-review 44724f1d`, scoped to this ticket's commit. The spec reviewer recounted the recall tables, the bar counts and the eight from the raw files and found them right, and checked that the control served the base docs byte for byte. Folded in: six, not five, open misses in the commit body; the verdict names the second causes; the other kinds' rows; the `follow-default-make` keyword miss; the "docs gap" row; and "random roll" dropped. Left as is: "function calling" now sits on three Tools sections and "random" on four Placeholders sections. Both stay on their own page, and the blind set lost no question.

### Seen, not fixed

- Porter stems "randomly" to "randomli" and "older" to "older", so an adverb or a comparative never meets its base word. A stemming rule is a search change, outside this ticket.
- Pick replies sometimes write a line under the wrong page title. The parse rule above found none of the eight live, so it did not ship.
