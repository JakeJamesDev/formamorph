# Upcoming narration and character selection: results

**Both descriptions select the right professional, but the upcoming-narration wording does not fix background retrieval.** It misses explicit character references as well as the ferry. Complete mention coverage is 10/12 for current wording and 7/12 for the candidate on this expanded fixture.

[Narration only](selection-scope-outputs.md) · [Thinking only](selection-scope-thinking.md) · [Exact prompts](selection-scope-prompt.md) · [Per-response audit](selection-scope-review.json) · [Protocol](selection-scope-protocol.md)

## Comparison

Both arms use the same fresh expanded world: six NPCs and a ferry. The new healer and cobbler provide relevant choices for two actions; the basketmaker and courier provide alternatives that are not required by those actions. The river-setting fact moves from System Prompt Addition into Current Location. Tone and global rules stay in the addition. Existing contextual ferry references and summaries remain intact.

A uses the preceding labeled description. B changes only its Use when sentence:

> Before using an entity in your upcoming narration, including as a background presence or through an indirect reference, unless its full entry is already in context.

The minimal narration instruction, `get_entity(name)`, Output description, model, limits, seeds, and fixture match within each pair. Neither arm receives cached entries. Six scenarios run twice per arm, with alternating arm order. This is a fresh baseline, not a comparison against the old world's 8/12.

## Measurements

| Metric | A: Current wording | B: Upcoming narration |
|---|---:|---:|
| Chooses and fetches the appropriate healer/cobbler | 4/4 | 4/4 |
| Cases fetching all action-required entries | 10/10 | 10/10 |
| Completed narrations | 12/12 | 12/12 |
| Every mentioned entity loaded | 10/12 | 7/12 |
| Explicit character mentions with full entry loaded | 10/10 | 10/17 |
| Object mentions with full entry loaded | 3/5 | 2/4 |
| Calls returning entries unused in narration | 0 | 0 |
| Invalid tool calls or empty lookup results | 0 | 0 |
| Clear contradictions of fixed entity facts found | 0 | 0 |
| Flagged mutable-posture mismatch | 0 | 1, unfetched courier |
| New lookup calls | 13 | 12 |
| Reasoning tokens, all requests | 4,445 | 3,981 |
| Average narration words | 175.9 | 180.1 |
| Sum of trial durations | 260.108 s | 239.149 s |

An entity counts once per narration, even when mentioned repeatedly. Explicit character mentions include unambiguous indirect references. The strict case score also conservatively counts ambiguous collective references; excluding those collectives leaves the 10/12 versus 7/12 result unchanged. Including collectives gives 13/19 loaded entity mentions for A and 12/27 for B. See the audit for all identities and ambiguity notes.

Thinking falls 10.4% in this batch; that does not offset the retrieval misses. Total batch duration is **499.320 seconds (8 minutes 19 seconds)**. No retry, cap increase, truncation, or transport failure occurred.

## What the added characters reveal

The candidate's five failing narrations are:

| Scenario | Explicit unfetched references |
|---|---|
| Quiet observation, first seed | Mara and Iven, through bandages and hammer sounds |
| Find a healer, first seed | Bram, while scanning the landing |
| Greet both people, second seed | Rope Ferry, in dialogue |
| Quiet observation, second seed | Corin, Iven, and Rope Ferry |
| Find a cobbler, second seed | Nessa and Corin, while scanning the landing |

The control's two failures are ferry references in both greetings. Its first quiet observation fetches the ferry before describing it; its second stays with water and dock planks.

Both arms choose Mara to tend the cut and Iven to inspect the damaged boot. Neither substitutes a distractor or fetches unrelated entries speculatively. The candidate instead adds unfetched people to the narration surrounding an otherwise correct selection. This supports a distinction between selecting the main participant and retrieving every participant used in prose. It does not establish failure on the important professional-selection decisions in this test.

The first candidate quiet-observation trace lists the nearby entities and considers their presence, then proceeds to writing without calls. Its narration mentions the healer and cobbler. This is evidence of a gap between the retrieval decision and the entities ultimately used; the trace alone cannot establish its internal cause.

## Factual review

No clear contradiction of fixed authored entity facts was found. Unsupported details are recorded separately from contradictions: a hammer for the cobbler is not prohibited by his entry, and a clear liquid used by the healer is not explicitly different from water.

One unfetched courier portrayal departs from authored staging. In the second candidate cobbler scene, he stands clutching his satchel, while his full entry says he keeps it on his lap. The audit flags this as a mutable-posture mismatch, not an immutable identity error; an author could permit a posture change. No transition is narrated. The strict lookup failure stands regardless of that interpretation.

These results do not make missed retrieval harmless: the full entry was unavailable to guide those portrayals. They also do not establish that every missed lookup produced a factual error. Engagement and acceptable improvisation remain for human review of the complete outputs.

## Decision and limits

Keep this candidate experimental. Clearer upcoming-narration wording alone did not improve the requested behavior in these paired cases. The expanded world answers the narrow question: incidental retrieval misses also affect characters, while choosing the appropriate character succeeds here. Broader worlds, models, session retention, and format comparisons remain outside this run's scope.

## Evidence and checks

- [Raw batch](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/selection-scope-batch-2026-09-22T20-47-19-042Z.json) includes the full derived fixture, both descriptions, all initial requests, responses, and loaded-model metadata. Model: `g4-meromero-v2-31b-i1`; seeds 424243/424244; thinking enabled; same 1,024-token cap and transport as the preceding experiment.
- All 12 request pairs differ only in the lookup description. Actual requests match prepared requests. Documents preserve 24 narration outputs and 45 thinking responses verbatim.
- Fixture tests: 2 passed in 4.432 seconds; fixture coverage 100% statements, branches, functions, and lines. The earlier implementation attempt failed both tests in 4.602 seconds because the fixture was extended after migration; adding entities before migration fixed the real setup. Removing their location membership then failed the intended guard in 2.270 seconds; source restored byte-for-byte. CLI paths are exercised by preparation and live inference, not included in fixture coverage.
- Application typecheck: exit 0, 15.916 seconds. Harness typecheck: exit 0, 2.213 seconds. Lint: exit 0, 14.434 seconds, existing Fast Refresh warning.
- Full suite: **12,557 passed, three skipped, exit 0 in 91.312 seconds**. Build: exit 0 in 17.145 seconds, existing bundle-size warning. Graph refresh: exit 0 in 129.406 seconds.
- Changelog updated. Application prompts, exports, defaults, and version are unchanged; the shared original Sedge Landing fixture is unchanged. The new fixture extends it only for this probe.
