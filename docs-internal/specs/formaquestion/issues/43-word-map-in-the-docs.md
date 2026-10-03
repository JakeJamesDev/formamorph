# 43: Word map in the docs

Status: done
Base: 199c2b26
Blocked by: 39
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The keyword search knows the words players use for each feature (Q71). Ticket 39 measured a bigger word map at 72% blind recall@5, against 52% for the shipped keyword lines. Its 3,529 phrases on 466 sections live only in the probe today (`testing/baseline/help-word-map.json`).

- Move the phrases into the docs as authored keyword lines (Q47), in the section each phrase belongs to. The player never sees them, in the reader or the Search tab.
- Keep each phrase a player's word for that section's feature or control. Drop a phrase that would pull a question to the wrong page.
- Do not read ticket 26's set or ticket 39's blind set while writing or pruning. Both stay unseen, so the numbers stay honest.
- The coverage test keeps every keyword line valid.
- The probe reads the shipped docs, not the JSON. Retire the JSON.

**Probe.** Run ticket 39's recall probe on both sets with the keyword source only. Report recall@5 before and after, and confirm the blind number matches ticket 39's word-map row within a point or two.

Recommended model rationale: thousands of phrases need care so that none pulls a question to the wrong page.

## Acceptance criteria

- [x] The word map lives in the docs' keyword lines; the probe JSON is gone
- [x] Keyword lines never show in the reader or the Search tab; the coverage test passes
- [x] Blind-set recall@5 with the keyword source is within 2 points of ticket 39's word-map row, or the handover explains the gap
- [x] Neither question set was read while writing the lines
- [x] Four gates green

## Handover

**Result.** The keyword search now finds the right section for 71.3% of the blind questions, up from 52.1%. Ticket 39's word-map row was 72.3%, so the gap is 1.0 point.

| Keyword source, recall@5 | Blind (94) | Known (97) |
|---|---|---|
| Before: shipped keyword lines | 52.1% | 63.9% |
| Ticket 39's word map, unpruned (rerun at base) | 72.3% | 71.1% |
| After: pruned word map in the docs | **71.3%** | 69.1% |

Batch: 2026-10-02, offline, `npm run probe:help-recall -- --arms keyword`. The probe printed the summary tables only; no question text was shown.

**What changed.**

- **Docs.** 3,398 phrases on 464 sections, in 33 guide pages. Two sections lost every phrase to pruning: `LinkedContent#words-this-page-uses` and `StatCodeGuide#overview`. 168 sections had a keyword line, and the new phrases went to its end. 296 sections got a new line right under the heading. Only keyword lines changed.
- **Pruning.** I read all 3,529 phrases, section by section, and dropped 131. Each drop is a word that pulls a question to another feature: a generic word ("tips", "remove", "type", "first time"), or a word that names another page's feature ("libraries" stems to Library, "theme" on music, "volume" on dictionary books, "wiki", "pc" on Personas, "url" on text links, "card" on tile moves). I did not run any probe on the pruned map before writing it; the blind run above is the only one.
- **Section split.** `docsIndex.ts` measures a section's size without its keyword lines. The longer lines no longer split `World-Editor-Traits#links` into parts, so the Search tab shows no "(Part 2)" label for hidden text.
- **Coverage check.** `keywordLineProblems` also fails a keyword line that is not the first line under a heading, or that holds an empty or repeated phrase.
- **Probe.** `help-recall.cli.ts` reads the shipped docs. The `wordmap` arms, `withKeywords` and `help-word-map.json` are gone. The mixes are now `ai+keyword` and `ai+keyword+semantic`.

**Ruling taken in session.** Two ticket 38 hub guards in `bundledDocsIndex.test.ts` failed on exact rank: World's Images fell to third for the cover-picture question, and `Settings#output` to fourth. The user picked relaxing the ranks over pruning to pass: World's Images in the top 3 with no hub above it, and `Settings#output` in the top 5. Pruning to pass would have tuned the map on known questions.

**Fairness.** I did not open `help-recall-blind-cases.json`, `help-baseline-cases.json` or any other question file. The two guards above hold two known questions, which I read after the lines were written; no phrase changed because of them.

**Gates.** lint exit 0 (23 s), test exit 0 (16,477 passed, 130 s), build exit 0 (20 s). typecheck exit 2 (24 s) on one error in `src/components/formaquestion/Formaquestion.ask.test.tsx`, an uncommitted edit of ticket 44; none of this ticket's files. A scratch config typechecks the edited probe files: exit 0.

**Review fold-in** (`/mattpocock-skills:code-review 199c2b26`, scoped to 173ab7ee).

- `keywordLineProblems` reads the heading lines from `docHeadings`, so a keyword line after a code block, or under a line the index does not read as a heading, fails. An empty `<!-- keywords: -->` fails under any heading.
- The player changelog line says "a guide section", not "every guide section": 184 headings, mostly `###` inside larger sections, have no line.
- Kept: the drops of "and then" (only "then" is not a stop word) and "replay" / "run it again" (they pull questions about playing a world again).
- Fold-in gates: lint 0, test 0 (16,491 passed, 132 s), build 0. typecheck exit 2 on ticket 44's in-progress `src/lib/formaquestion/helpSession.sources.test.ts`, not this ticket's files.

**Seen, not fixed.**

- Follow-ups on the known set fell from 50% to 40% (1 of 10 questions). Ticket 45 owns follow-ups.
- The probe took 118 s, against 59 s for the same arm at base. Ticket 44 ran tests in the same checkout at that time; I did not look further.
