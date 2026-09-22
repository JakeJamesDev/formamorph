# Probe-Only Entity Selection Variant

## Outcome

The three proposed wording changes did **not** establish an improvement over the [thinking-on baseline](thinking-findings.md). Native write completion stayed at **2/4**, but the successful cases moved to both greetings. Both water-inspection controls exhausted the unchanged token cap while reasoning, without retrieving lore or producing narration.

No production prompt changed. The standalone probe source was temporarily modified and restored byte-for-byte after the run. All initial request fields outside `messages` matched the thinking-on baseline. Model, tool definitions, automatic tool choice, seed, thinking-on default, 1,024-token cap, timeout, and ID mapping stayed unchanged.

## Experimental wording

Dialogue guideline:

> Let the player's action determine the scene's focus. When the player speaks to someone, give that character a relevant response. For observation or physical actions, describe what the player notices or what changes; include dialogue when the situation gives a character a reason to speak.

Entity-selection instruction:

> The location's entity list shows who or what may be available. Choose which entities are relevant to this turn before requesting descriptions. Retrieve the full description of each entity you plan to portray, unless it is already in context. An opening scene can establish the setting through the player's immediate action without introducing every listed entity.

First-action instruction, replaced in both the system and user message:

> Begin with the player's action as it happens. If the action includes speech, render that speech and the addressed character's response. Deliver the completed narration by calling write.

The surrounding summary notice and follow-up lookup instructions remained intact. The three changes were tested together, so their individual effects cannot be isolated.

## Results

| Trial | Lookups | Requests | Native write | Observation | Duration |
|---|---:|---:|---|---|---:|
| Main 1 | 3 | 3 | Yes | Combined-name query failed; separate queries recovered; narration used three paragraphs | 43.403 s |
| Main 2 | 2 | 2 | Yes | Both descriptions retrieved; player's greeting paraphrased rather than quoted | 23.307 s |
| Control 1 | 0 | 1 | No | Finished with `length`, 1,024 completion tokens | 31.912 s |
| Control 2 | 0 | 1 | No | Finished with `length`, 1,024 completion tokens | 31.226 s |

Both controls reported 1,021 reasoning tokens, empty ordinary content, and no native calls. Their missing lookups are **not evidence of better selectivity**: the exposed reasoning still planned to portray Odette using her summary, and neither delivered a completed scene.

## What the exposed reasoning adds

- **Summary/full-description ambiguity:** Control 1 explicitly decided summaries were sufficient for a first scene. Control 2 treated the descriptions in the system prompt as sufficient. Main 1 also considered using summaries after an empty lookup, although it then successfully retrieved the full descriptions. The reuse clause did not reliably distinguish summaries from previously returned full descriptions.
- **Single-name argument ambiguity:** Main 1 sent `request_info({"term":"Bram, Odette"})`, received no matches, then recovered with two separate calls. The current tool accepts an exact name or configured alias, not a comma-separated list. The tool description's generic “name or keyword” wording and undescribed `term` parameter did not communicate that boundary clearly in this case.
- **Continued scene expansion:** Both controls considered remaining focused on the water, then drafted a nearby character's involvement anyway. Their reasoning referenced the remaining ending and character-introduction guidelines. These are clues about interpretation, not proof of internal causality.
- **Quality did not uniformly improve:** Main 1 broke the one-paragraph instruction and gave only the ferryman quoted speech. Main 2 included both NPC voices but paraphrased the player's speech. Both used retrieved details without leaking character names. The controls' unsubmitted drafts invented a jagged scar from the summary rather than the authored burn-scar description.

The next targeted hypotheses are to distinguish returned full descriptions from summaries explicitly, and document that `term` accepts one listed entity name per call. Those changes were **not** made in this run. A larger reasoning budget would be a separate experiment; increasing it here would break the prompt-only comparison.

## Timing and evidence

The valid batch took **129.848 seconds**, versus 105.420 seconds for the thinking-on baseline. CLI wall time was **143.523 seconds**. It reported 10,763 prompt tokens and 4,040 completion tokens, **14,803 total**, including 3,575 reported reasoning tokens. No request hit the three-minute timeout.

An earlier attempt was stopped after 30.709 seconds when inspection revealed Windows PowerShell had misdecoded typographic apostrophes in the temporary runner. Its source was restored, the runner was corrected to ASCII-safe wording, and that interrupted attempt was excluded from all results. No completed evidence batch from that attempt was used.

- Model: `g4-meromero-v2-31b-i1`.
- Source base: `f497a96a`, with temporary standalone prompt substitutions and thinking enabled.
- [Valid transcript](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/lm-studio-batch-2026-09-22T12-01-21-028Z.json)
- SHA-256: `a0b5efec540485f3965952451bae7c9c168efeb9aad79a87a3a098287696634e`.

Verification consists of the live batch, matching non-message request fields, and clean diffs for the production prompt and restored probe. No persistent code changes required repository gate reruns. This remains a four-case diagnostic, without a separate one-entity case or a reliability estimate.
