# Expanded description experiment

## Scope and fixed protocol

Compare the original lookup description (A) with the information-focused description (B) from [the first comparison](description-findings.md). The only A/B request difference is that description. This is a local follow-up on the loaded `g4-meromero-v2-31b-i1`, not a production rollout or a cross-model verdict.

Run 48 fresh trials: six scenarios × four seeds × two arms. Seeds are 424243–424246, excluding the earlier smoke-test seed. Alternate A/B and B/A order across case/seed pairs. Retain thinking enabled, automatic tool choice, single-string `term`, unchanged `write`, the full prompt, 1,024 response tokens, four request rounds, and 180 seconds per request. Do not add repairs or increase budgets during the run.

| Scenario | Action focus | Full lore supplied before generation | Required lore before successful narration |
|---|---|---|---|
| greeting | Ask both characters about themselves | None | Bram, Odette |
| odette | Study the eel-smoker's face/hair and ask about preparation | None | Odette |
| ferry | Inspect construction and passenger capacity | None | Rope Ferry |
| environment | Silently inspect water and dock colors/textures, without interacting | None | None |
| cached-bram | Ask crossing hours and inspect sleeve/jewelry | Bram | Bram |
| mixed-cache | Ask both characters about themselves | Bram | Bram, Odette |

The world and available entities remain unchanged. The environment case explicitly probes restraint; it does not remove NPCs. The object inspection adds an entity not targeted in earlier trials. Cached cases begin after a valid synthetic assistant lookup and real authored tool result within the current turn. They test reuse within a tool loop, not memory across completed user turns. Original prompt instructions remain present even if they encourage introductions or repeated retrieval.

## Scoring, before reviewing results

- **Primary:** native `write` completion out of all planned trials, with paired wins/losses reported.
- **Required information:** completed narration has all case-required descriptions available from preloaded results or successful lookups. Report separately from completion.
- **Protocol failures:** invalid arguments, unknown function, mixed lookup/write, plain prose, response truncation, and infrastructure errors remain separate.
- **Lookup quality:** successful matches, unmatched queries, redundant retrieval of already-available entities, and entities retrieved but not portrayed in delivered narration. Review portrayals manually; do not infer them solely from proper names.
- **Restraint:** report environment lookups and NPC involvement, distinguishing incidental mention from an interaction. Do not quietly redefine this case based on the result.
- **Narration:** inspect each delivered output for required-task fulfillment, single paragraph, use of retrieved details, unsupported canon contradictions, and unintroduced names. Protocol success is not story success.
- **Cost:** total and per-trial time, reported tokens, and completed-task cost. Compare latency cautiously if completion rates differ.

Failures remain in denominators. Report first-pass and recovered behavior separately if an unmatched lookup is later corrected. No automatic retry after a terminal failed trial. A server rejection, timeout, or transport error stops the batch with its partial evidence preserved; do not count unrun trials as model failures.

Four seeds per scene support a broader diagnostic, not a population reliability claim. All samples share one model, one world, one prompt, and server defaults for omitted samplers. Report paired results and uncertainty; the two cached scenarios are closely related, not independent task families.

## Reproduction and verification

Run the committed CLI through Vite Node: `vite-node testing/baseline/harness/narration-tool-description.cli.ts --run g4-meromero-v2-31b-i1`. Omitting arguments prepares all 48 requests without inference. It checks all 24 initial pairs differ only in description, verifies the requested model is loaded, and checkpoints raw evidence after every trial under `testing/baseline/runs/narration-tool-call-probe/`.

Offline tests exercise paired isolation, cached-result preservation across a new lookup, outgoing call/result ID matching, and invalid cache preparation. Deliberately removing description replacement and cached history makes the corresponding tests fail. No production prompt, runtime, world fixture, save shape, or app default changes are part of this experiment.
