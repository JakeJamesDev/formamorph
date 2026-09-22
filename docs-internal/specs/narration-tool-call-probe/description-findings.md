# Description-only comparison

## Result

The information-focused `request_info` description completed **4/4** native lookup-to-write trials, versus **2/4** with the existing description. Retrieval became selective in one observation trial. This is promising diagnostic evidence, not a reliability estimate: there are only two actions, repeated twice at the same seed, on one loaded model.

## Controlled change

Fresh baseline A used:

> Retrieve full descriptions of world entities by name or keyword.

Variant B used the candidate from the [expert research baseline](../../notes/tool-calling-expert-baseline/notes.md):

> Retrieve full authored descriptions for world entities you plan to portray. The available summaries identify entities but omit their detailed lore. Use this tool when that entity's full description is not already in context. Supply names from the available-entity list.

Only that description changed between A and B. All four corresponding initial request bodies were compared after normalizing this field and matched exactly. The single-string `term` schema, `write` description, full narration messages, automatic tool choice, seed 424242, 1,024-token response cap, three-minute timeout, and nine-character outgoing call IDs stayed unchanged. No examples or mandatory tool-choice settings were added.

Model: `g4-meromero-v2-31b-i1`, already loaded in LM Studio. Thinking stayed enabled by omitting `reasoning_effort`, matching the earlier [thinking-on experiment](thinking-findings.md). The prior experimental scene-selection wording was not included. Temperature and repetition penalty remained omitted.

The existing standalone harness was temporarily modified for execution, then restored byte-for-byte in a `finally` block. Production prompts were untouched. A ran before B; trial order was greeting twice, then water observation twice. This does not control for all order/cache effects or sample different seeds.

## Measurements

| Metric | A: existing description | B: information-focused |
|---|---:|---:|
| Successful native `write` | 2/4 | 4/4 |
| Greeting completion | 1/2 | 2/2 |
| Observation completion | 1/2 | 2/2 |
| Lookup calls / successful matches | 8/8 | 7/7 |
| Prose instead of `write` | 1 | 0 |
| Token-cap exhaustion | 1 | 0 |
| Delivered single-paragraph narration | 1/2 delivered | 3/4 delivered |
| Model batch duration | 102.197 s | 98.600 s |
| Reported total tokens | 15,367 | 15,910 |

| Trial | A outcome / lookups | B outcome / lookups | B duration |
|---|---|---|---:|
| Greeting 1 | Plain prose / Bram, Odette | `write` / Bram, Odette | 29.087 s |
| Greeting 2 | `write` / Bram, Odette | `write` / Bram, Odette | 28.032 s |
| Observation 1 | Token cap / Bram, Odette | `write` / Bram, Odette | 18.027 s |
| Observation 2 | `write` / Bram, Odette | `write` / Bram | 23.454 s |

All executed lookups used valid individual names and returned matches. No lookup repair was needed in either arm. A reproduced the previous thinking-on baseline's completion pattern and token totals. Total runner wall time was **229.874 seconds**, including two CLI startups. An initial launch failed before inference because `npm` was unavailable on PATH (1.351 seconds); the valid run invoked the installed Vite Node entry point directly.

## Retrieval and narration review

- Both B greetings fetched and portrayed both characters, using withheld details such as the burn scar, green bead, and brass ring. Both quoted the player's greeting. Greeting 2 gave only Bram a spoken response; Odette reacted physically.
- B observation 1 fetched both characters but portrayed only Odette: one unused retrieval remained. Its narration used her authored right-cheek burn scar and green bead, but split into two paragraphs.
- B observation 2 planned a ferryman response, fetched only Bram, then portrayed him using the brass ring and dry speech. This is the strongest selective-retrieval example in this batch.
- Every listed entity portrayed in B's delivered narration had first been retrieved. Neither character's unintroduced name appeared in those outputs. These narrow checks are not an exhaustive canon-quality assessment.
- A's delivered greeting implied Bram had a missing ear; its delivered observation described his single arm as pinned to his side. Those particular distortions did not recur in B, but the sample does not establish a general fidelity improvement.

Both B observations still introduced an NPC into an action focused on water. The exposed reasoning in observation 2 tied that decision to the unchanged first-beat/dialogue instruction. Observation 1 retrieved both to consider their reactions before selecting Odette. Those are observable planning differences, not proof that the description alone explains every downstream change.

Fewer lookups are not automatically better: introducing a character is allowed by the existing scene instructions. The useful selectivity check is whether requested lore supports the delivered portrayal. There is no completed no-NPC example here to establish that the model reliably skips unnecessary retrieval entirely.

## Evidence and next step

- Source revision: `667f19f9`.
- [Baseline transcript](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/lm-studio-batch-2026-09-22T12-32-24-834Z.json), SHA-256 `0f834c80a2fbc8d35e9c303fdff185375a6496c384d4e664b43246059e6cadff`.
- [Variant transcript](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/lm-studio-batch-2026-09-22T12-34-16-818Z.json), SHA-256 `105d5b5ad410fd86062e87d9ba726827f7f5b4afc6514ebaefb32babcdbaee6d`.

The live runs, exact initial-request comparison, byte-for-byte restoration, and clean source diff are the verification. No persistent code changes or production prompt changes required repository gate reruns. Raw transcripts are local gitignored artifacts.

Keep B as the candidate for broader testing across held-out scenes and different seeds before adoption. Add already-retrieved, single-entity, and genuinely no-needed-lookup cases before claiming robust selection. This experiment does not establish cloud behavior, strict-schema support, or a winning argument syntax.
