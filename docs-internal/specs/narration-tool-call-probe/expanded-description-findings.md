# Expanded lookup-description findings

## Outcome

The information-focused description improved native narration delivery in this matrix: **19/24 versus 14/24**. It did not reliably solve retrieval selection or story adherence. After requiring full descriptions to be available for every required and substantively portrayed entity, successful deliveries were **16/24 versus 12/24**.

Keep the new description as a candidate, not a validated production fix. In particular, the mixed-cache scenario regressed from four completions to two. Both descriptions sometimes portrayed entities using only summaries, and neither respected the environment-only control consistently.

The [fixed protocol](expanded-description-protocol.md) specifies the cases and scoring. The [per-trial review](expanded-description-review.csv) contains all 48 outcomes, mechanical metrics, and manual portrayal annotations. No production prompt changed.

## Results

| Metric | A: original | B: information-focused |
|---|---:|---:|
| Native `write` completion | 14/24 (58.3%) | 19/24 (79.2%) |
| Completion with required and portrayed full lore available | 12/24 (50.0%) | 16/24 (66.7%) |
| Response-cap failures | 7 | 4 |
| Finished prose instead of `write` | 3 | 1 |
| Lookup calls | 38 | 30 |
| Unmatched lookups | 1 | 0 |
| Repeated lookup of already-returned lore | 0 | 0 |
| Single paragraph among delivered narrations | 10/14 | 17/19 |
| Unintroduced NPC names in delivered narration | 0/14 | 1/19 |
| Retrieved entities unused in delivered narration | 3 across 14 deliveries | 3 across 19 deliveries |

All emitted calls parsed and passed argument validation. The unmatched query was `Sedge Landing`, a location requested through the entity-only lookup. It returned no matches; the trial later exhausted its token cap. No trial recovered from an unmatched query to a successful `write`. There were no infrastructure failures, omitted trials, or replacement reruns.

Availability of lore is not proof of faithful use or fulfillment of the player's action. For example, the three B environment deliveries have their NPC lore available, yet all introduce NPC speech despite the player's environment-only action.

| Scenario | A completion | B completion | A completion with full lore | B completion with full lore |
|---|---:|---:|---:|---:|
| Greeting both characters | 2/4 | 4/4 | 2/4 | 4/4 |
| Inspect and question Odette | 4/4 | 4/4 | 4/4 | 4/4 |
| Inspect the ferry | 2/4 | 3/4 | 1/4 | 1/4 |
| Environment-only observation | 0/4 | 3/4 | 0/4 | 3/4 |
| Bram already retrieved | 2/4 | 3/4 | 2/4 | 3/4 |
| Bram retrieved, Odette still missing | 4/4 | 2/4 | 3/4 | 1/4 |

Across 24 matched pairs, B alone completed **8**, A alone completed **3**, both completed **11**, and neither completed **2**. The observed difference is 20.8 percentage points. A nominal two-sided exact paired sign/McNemar test on the 11 discordant pairs gives **p = 0.227**; this does not establish a statistically conclusive improvement. Shared scenarios further limit the independence assumption. Four seeds on six scenes in one world cannot estimate broad model reliability.

## Failures worth preserving

### Correct facts can come from summaries

The ferry summary already says it holds two people and lists left. Correct capacity alone therefore cannot demonstrate full-lore retrieval.

- B, ferry, seed 424245: fetched only Bram, then described the ferry without its full entry.
- A, ferry, seed 424246: fetched Bram and Odette, then described the ferry without its full entry.
- B, ferry, seed 424246: fetched the ferry, then portrayed Bram without his full entry and named him before introduction.

The full prompt explicitly requires full descriptions before portrayal. These outputs violate that retrieval contract even where their summary-derived facts happen to be correct.

### Partial caches can be mistaken for complete context

Both arms had one mixed-cache delivery that skipped the missing Odette lookup: A at seed 424245 and B at 424246. Only Bram's complete description had been supplied. A described multiple deep scars where the authored entry specifies a burn scar; B stayed with a generic scarred-face description.

Neither arm redundantly fetched Bram in any cached case. That is a useful success, but it does not mean both reliably recognized which other descriptions were still missing. The two additional B mixed-cache failures were token-cap failures after correctly retrieving Odette.

### Environmental restraint is unresolved

All eight environment trials performed NPC lookups. A retrieved 11 entries across four trials; B retrieved eight. A never delivered through `write`; B delivered three times and included NPC speech in all three. Neither arm produced a completed, interaction-free environment scene.

Do not interpret A's zero completed interactions as better restraint: it had zero completed stories. Failed ordinary-prose responses remain in the raw evidence, but are not scored as delivered narration.

### Budget and output routing dominate protocol failures

Eleven failures reached the unchanged 1,024-token cap; four finished ordinary prose without calling `write`. None failed from malformed arguments. Some capped responses were reasoning-only; others began prose before truncation. Increasing the cap or requiring a tool call would be separate experiments, not an explanation proven by this comparison.

## Manual review boundaries

Every submitted narration was read. Portrayal annotations count an entity that acts, speaks, or receives substantive description. Incidental references such as looking toward the ferryman or mentioning a background raft are not counted as portrayals requiring an additional entry. Unused retrievals are calculated only for completed narrations, since failed trials never commit to a final scene.

The CSV's `groundedCompletion` means descriptions were **available**, not that every generated sentence was correct. The review also records player-speech omissions, paragraph breaks, possible sleeve/scar distortions, NPC refusals, and invented elaborations. A distrustful NPC refusing to explain a trade is not automatically a task failure. No calibrated model judge or comprehensive canon score was used.

## Timing, controls, and evidence

- Model: loaded `g4-meromero-v2-31b-i1`, thinking enabled; server metadata captured in the transcript.
- Seeds: 424243–424246; A/B order alternated by scenario and seed. Fresh conversation per trial.
- All 24 recorded initial request pairs match after removing only `request_info`'s description. Syntax, messages, known lore, tool choice, budgets, and sampler fields match within each pair.
- Trial duration totals: A **707.183 s**, B **703.639 s**. Entire batch **1,411.028 s**; CLI wall time **1,424.598 s** (23 min 45 s).
- Tokens: A **88,497** (66,709 prompt, 21,788 completion); B **89,854** (68,103 prompt, 21,751 completion). Reported reasoning tokens: A 18,263, B 17,716.
- Lint ran during the beginning of the live batch, so timings are observational, not an isolated performance benchmark. Full tests and build ran afterward.
- [Raw transcript](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/description-expanded-2026-09-22T12-42-18-347Z.json), SHA-256 `117be0f5273da213ecb33fc7597781a760466e466bc4613c27dfca8a375aa8a0`.
- Recorded base revision: `b8d81ee3`; the runner and experiment options are added with this report. Raw transcripts remain local and gitignored.

## Recommended next experiment

Keep the description fixed and isolate the response budget first, using the failing paired cases. Then test mandatory tool choice if the endpoint honors it. Those changes target the measured delivery failures. Retrieval policy for objects, newly introduced entities, and partial caches remains a distinct problem to test afterward.

No argument-syntax winner or cross-model claim follows from this run. The result supports continuing with the clearer description while keeping its mixed-cache regression and incomplete retrieval visible.

## Harness verification

- Offline probe tests: **33 passed**, 5.158 seconds including coverage. Shared probe coverage: **96.53% statements/lines, 86.70% branches, 100% functions**. The CLI is exercised by offline preparation and the live batch; that percentage does not include the CLI.
- Mutation checks: disabling description replacement, omitting cached tool history, and accepting missing cached lore made the three new tests fail for their intended assertions; source restored afterward. Final mutation run: 2.308 seconds.
- Repository typecheck: exit 0, 15.006 seconds. An additional targeted check includes the harness files excluded by the main project configuration: exit 0, 2.213 seconds.
- Lint: 0 errors, one existing Fast Refresh warning in `WorldOverviewManager.tsx`; 13.611 seconds.
- Full tests: **12,531 passed, 3 skipped**, exit 0; 87.951 seconds. An earlier sandboxed run took 87.376 seconds and failed three existing changelog subprocess tests with `spawnSync node EPERM`; the successful run granted child-process permissions without modifying those tests.
- Production build: exit 0, 17.065 seconds, with bundle-size warnings. Changelog entry folded into the existing probe entry and copy-reviewed.
- Production prompts, authored fixture, export shapes, version, and application defaults are untouched. Only the standalone experiment harness and documentation changed.
