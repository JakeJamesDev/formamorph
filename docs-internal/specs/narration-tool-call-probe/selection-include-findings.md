# Inclusion wording: results

**The inclusion wording reduces misses relative to the preceding upcoming-narration candidate, but does not surpass the saved control on explicit references.** All required retrieval and professional-selection cases succeed. Two narrations still contain definite unfetched references; a third has an ambiguous crowd reference.

[Narration only](selection-include-outputs.md) · [Thinking only](selection-include-thinking.md) · [Exact prompts](selection-include-prompt.md) · [Per-response audit](selection-include-review.json) · [Protocol](selection-include-protocol.md)

## What was tested

The candidate changes both Purpose and Use when to the approved wording:

> Purpose: Retrieve the full authored information needed to narrate an entity. Summaries help you choose which entities to include.
>
> Use when: Before including an entity in your upcoming narration, retrieve its full entry unless already loaded for this response. This applies to direct and indirect references, including background appearances. Leave unrelated entities unfetched.

Input, Output, `get_entity(name)`, the minimal system prompt, expanded fixture, actions, seeds, model settings, and limits stay unchanged. Twelve new candidates are compared with twelve saved control responses after verifying complete control-request equality and matching loaded-model metadata. No control inference was repeated. This tests the complete wording change, not the isolated word “include.”

## Measurements

The prior-candidate column comes from the [preceding selection experiment](selection-scope-findings.md), not a new run.

| Metric | Saved control | Prior “using” candidate | New “including” candidate |
|---|---:|---:|---:|
| Required retrieval cases | 10/10 | 10/10 | 10/10 |
| Correct professional selection and retrieval | 4/4 | 4/4 | 4/4 |
| Completed narrations | 12/12 | 12/12 | 12/12 |
| Every mentioned entity loaded, conservative collectives | 10/12 | 7/12 | 9/12 |
| Every explicit entity reference covered | 10/12 | 7/12 | 10/12 |
| Explicit character mentions covered | 10/10 | 10/17 | 10/11 |
| Object mentions covered | 3/5 | 2/4 | 3/4 |
| New lookup calls | 13 | 12 | 13 |
| Retrieved entries unused in narration | 0 | 0 | 0 |
| Reasoning tokens | 4,445 | 3,981 | 4,736 |
| Mean narration words | 175.9 | 180.1 | 190.9 |

Mention counts are unique entities per narration. New calls have valid syntax and nonempty results. Thinking is 6.5% higher than the control. The candidate batch took **296.650 seconds (4 minutes 57 seconds)**; no retries, cap increases, or truncations occurred.

## Remaining misses

- **First quiet observation:** mentions the sound of Iven's hammer without retrieving him.
- **Second greeting:** includes the ferry in NPC dialogue without retrieving it.
- **First healer scene, ambiguous:** refers to a “small crowd.” The conservative audit assigns that collective to the other listed people. Excluding the ambiguous collective changes 9/12 to 10/12. The healer herself is retrieved.

The second quiet observation now fetches the ferry and confines its entity references to it. Both cobbler scenes stay with the fetched cobbler, rather than adding unfetched distractors. Both professional choices remain correct.

Relative to the prior candidate, fewer incidental people appear, while the number of character lookups stays the same. The extra call is for the ferry. Most of the coverage improvement therefore comes from omitting unfetched background people, not retrieving more people. All narration remains available for judging whether that focus is desirable.

## Factual review

No direct contradiction of an explicit fixed entity fact was identified. That is not a claim that the narration is fully faithful: the second greeting describes a ring in Bram's “remaining ear,” inventing a missing ear even though his full entry was retrieved. The entry specifies a missing arm and a ring through his left ear, without explicitly stating that both ears are intact. The audit records this as an unsupported identity detail rather than a literal contradiction. The unfetched cobbler's hammer is also unsupported but not expressly prohibited.

This distinction keeps the contradiction metric consistent with the preceding review while exposing a separate fidelity problem. Retrieval alone does not guarantee that the model uses retrieved facts accurately.

## Interpretation

This wording is a more promising candidate than the preceding “using” version on these cases, but not a demonstrated improvement over the saved control. The definite failures still cross both character and object references. Twelve same-world trials cannot establish a general advantage; no broader reliability claim or production prompt change is made.

## Evidence and checks

- [Raw candidate with embedded cached controls](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/selection-include-batch-2026-09-23T03-53-24-862Z.json). Model `g4-meromero-v2-31b-i1`, seeds 424243/424244, thinking enabled, unchanged caps and transport.
- All control requests match the saved baseline exactly. Each candidate differs only in the tool description. All actual initial requests match preparation; all 24 narration texts and 46 thinking responses are preserved in separate documents.
- Changing a seed triggers the intended cached-request rejection in 16.882 seconds; source restored byte-for-byte. This check performs no inference.
- Focused fixture tests: 2 passed in 5.116 seconds; fixture coverage 100% statements, branches, functions, and lines. CLI preparation/live branches are exercised directly and not included in that coverage percentage.
- Application typecheck: exit 0 in 15.652 seconds. Harness typecheck: exit 0 in 2.576 seconds. Lint: exit 0 in 14.516 seconds, existing Fast Refresh warning.
- Full suite: **12,557 passed, three skipped, exit 0 in 104.736 seconds**. Build: exit 0 in 19.533 seconds, existing bundle-size warning. Graph refresh: exit 0 in 156.743 seconds.
- Changelog updated. Application prompts, world/save export shapes, defaults, version, and the shared fixture are unchanged.
