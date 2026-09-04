# 07 — Triggers tracer

**What to build:** An author pastes prose and immediately sees what fires and why not. The Triggers
tab: a scene-text input re-evaluated live (debounced); an Entities Present list showing each
detected entity with the alias and highlighted span that matched; a Dictionary list showing every
entry fired-or-not — fired rows with reason badge, matched keyword, literal text, region; non-fired
rows with their near-miss reason (no keyword; secondary present and excluded; secondary required and
absent; matched only beyond scan depth; substring blocked by whole-word; entry disabled; book
disabled — greyed with the reason). Invalid regex flags the entry inline rather than failing the
run. Empty text shows constant entries with a note they always inject; "nothing fired" states how
many entries were checked.

**Blocked by:** 01 — Bench surface + Issues tracer · 06 — Entity-match span reporting.

Status: done

- [x] Runs the game's real activation and matching functions — no parallel implementation
- [x] Every near-miss reason class from the spec is rendered and fixture-tested as a string
- [x] Highlighted spans in the pasted text open the same evidence as the list rows
- [x] Live evaluation stays responsive on a large dictionary (debounce, no button)
- [x] Empty and nothing-fired states read as results, not breakage

**The seam:** `buildTriggerReport(world, sceneText, {history}) → TriggerReport` in
`src/lib/testBench/triggers.ts`, plus `describeNearMiss(entry) → string`. `useDebouncedTriggerReport`
(250ms) drives it; `TriggersInstrument.tsx` renders it; the scene text lives in `WorldEditor` so a tab
switch doesn't discard it. Dev route: `#dev?modal=worldEditor&bench=triggers`.

**Decisions taken here:**

- `stripQuotedSpeech` blanks speech to same-width spaces (newlines kept) rather than collapsing it, so
  presence spans index the author's own text. Ticket 06 offered this or highlighting the stripped text;
  the padding is the one that lets the highlight land on what was pasted. Three assertions updated.
- Near-miss classes are decided by re-asking the *same* matcher a narrower question (probe `matchHits`
  with a relaxed flag / a dropped history slice / one secondary key), never by a second matcher.
- Three seams extracted so the tracer and the activation pass cut the same windows:
  `historyForEntry`, `invalidRegexKeys`, `matchRuleOf` in `dictionaryUtils`.
- A muted book's entries are held back from `explainActivation` rather than filtered out of its results —
  play never scans them, so running them would invent a verdict.

**For ticket 08:** the history input is already plumbed (`opts.history`, oldest→newest, regions
`history:<i>`); only the UI for it and the turn-distance labels are missing. `describeRegion` collapses
every history region to "History" — 08 wants the distance. Segments deliberately drop non-scene hits.
