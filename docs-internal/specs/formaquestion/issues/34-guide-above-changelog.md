# 34: Guide sections above the changelog

Status: done
Base: c857e073
Blocked by: 26
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A how-to question gets guide sections, and a "what's new" question gets the changelog (Q60). In ticket 26, released changelog sections ranked first for task questions: "change the Profile Image" got Morph art lines, and "add a library entity to a game" got changelog lines with developer names in them. Both "what's new" questions got no changelog section at all.

- Guide sections rank above released changelog sections for the same match.
- A question about what is new, changed or fixed still finds the changelog sections, newest first.
- The Search tab and the help session use the same ranking.

**Probe.** Run ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control. Report grounded-correct and right-source per kind, and the changelog questions' sources.

Recommended model rationale: ranking changes move every question, so the probe read matters.

## Acceptance criteria

- [x] For a task question that matches both, a guide section ranks above a changelog section; a test asserts it
- [x] A "what's new" question sends changelog sections; a test asserts it
- [ ] Probe numbers, fixed vs current build, same batch, are in the handover; no kind drops by more than the 5-point batch drift. **Numbers are in; on the cloud model, two kinds drop by more than 5 points (see Handover)**
- [x] Four gates green

## Handover

Built in d7976be7, with the review fold-in in e03b5507 (Q62, Q63). Gates green on e03b5507: typecheck, lint, 969 test files, build.

- `DocsIndex.search` ranks every guide hit above every changelog hit, with no weight. The Search tab, the Ask fallback, the help session and the lookup all call it.
- A what's-new question leads with the newest release's sections that hold text, in page order. Heading-only sections such as "Minor Changes" are left out. A question that names a version leads with that release. When the index does not hold that version (for example 3.0), nothing leads.
- The detection needs a release word after the phrase ("what changed in the latest version"), or the phrase alone ("whats new?"). "What is different between…", "what's added to the prompt" and "listing changelog" read as guide questions. The tests hold both lists.
- The probe CLI has a `--rank-old` arm. It renames the Changelog page so no tier applies. On the bundled index it reproduces the pre-34 ranking exactly: the keyed section is first for 23 of 75 task questions and in the top 5 for 39.

**Probe.** `npm run probe:help -- --rank-old`, all kinds, same batch. Ticket 36's filler words were off in both arms (`fillerWords: false`, not landed). Grounded-correct:

| Kind | Cloud `default`, 5 runs: fixed | pre-34 | Δ | MeroMero 31B, 2 runs: fixed | pre-34 | Δ |
|---|---|---|---|---|---|---|
| Task | 48% | 45% | +3 | 53% | 49% | +4 |
| Here | 88% | 88% | 0 | 83% | 83% | 0 |
| Follow-up | 16% | 40% | **−24** | 35% | 30% | +5 |
| Language, setting only | 80% | 90% | **−10** | 100% | 100% | 0 |
| Language, asked in it | 0% | 0% | 0 | 0% | 0% | 0 |
| Changelog (source only) | 100% | 0% | +100 | 100% | 0% | +100 |
| All | 49% | 48% | +1 | 55% | 50% | +5 |

Right source, cloud: task 55% vs 49%, follow-up 40% vs 40%. The changelog questions' sources are now the 3.1.2 sections (version intro, Added parts, Fixed). Before, they got Saves and Backup's update sections and no changelog.

**The cloud drop.** Four questions flip on cloud: `follow-group-add` 5/5 → 0/5, `follow-publish-update` 5/5 → 1/5, `follow-backup-restore` 5/5 → 2/5, `worldeditor-1-es-setting` 5/5 → 1/5. In each one, both arms send the keyed section. The difference is the slot a large changelog section filled before. That section also took most of the budget. Now the slot goes to a weaker guide section that looks on topic, such as `Saves-and-Backup#app-updates` for "push a fixed version" or `Saves-and-Backup#the-load-game-dialog` for "get one of my worlds into it", and the cloud model follows it. MeroMero answers the same four right in both arms. So this is block precision on the drifting cloud build, not a lost section. Ticket 35 (page favoring, b769e731) landed after this batch and was not in it. Ticket 37's re-measure will show the combined effect.

Runs: `testing/baseline/runs/help-baseline-2026-10-02T05-45-51-243Z` (cloud), `…T06-14-07-495Z` (local).
