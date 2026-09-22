# Narrator role and context only

**[Read all twelve narration pairs](role-only-outputs.md).** Each action has clearly labeled “Previous prompt” and “Minimal prompt” final narrations. [Thinking traces and tool calls](role-only-thinking.md) and the [complete minimal system prompt](role-only-prompt.md) are separate documents. No outputs were selected, rewritten, or omitted. The user's subjective assessment of the prose remains open.

## Measured result

All twelve candidates completed. They used fewer reasoning tokens and produced longer narration, but made no lore calls. This supports testing simpler instructions while exposing a retrieval tradeoff; it does not establish that the longer prose is better.

| Metric | Decision-notes baseline | Role and context only |
|---|---:|---:|
| Completed narration | 12/12 | 12/12 |
| Reasoning tokens across batch | 6,876 | 3,031 |
| Average reasoning tokens per trial | 573 | 253 |
| Trials with prose drafted inside reasoning | 6/12 | 1/12 |
| Trials with repeated prose drafts inside reasoning | 1/12 | 0/12 |
| New required lore retrieved | 8/8 | 0/8 |
| Lookup calls | 12 | 0 |
| Completed with all required and substantively portrayed full entries available | 11/12 | 3/12 |
| Average narration words | 112.7 | 211.5 |
| Single-paragraph narrations | 8/12 | 0/12 |
| Paragraph range | 1–2 | 3–10 |
| Silent observations without NPC interaction | 2/2 | 2/2 |
| Unintroduced entity names in narration | 0/12 | 1/12 |
| Completion tokens, including reasoning | 8,841 | 6,377 |
| Prompt tokens across requests | 30,733 | 7,506 |
| Batch time | 282.595 s | 198.879 s |

Word counts use whitespace-separated nonempty strings. Paragraphs, names, and dialogue patterns are observations rather than automatic failures against removed instructions. Full-entry availability is separate from correctness: a guessed detail does not count as retrieved lore. Both cached-Bram cases and the second environment case meet the full-entry criterion. The first environment case adds a detailed ferry-rope description without its entry, following the same substantive-portrayal criterion used for the baseline.

## What the outputs show

- **Thinking continued without a preparation instruction.** The model still used plans, state recaps, and world-rule checks. The first Odette trial drafted prose fragments inside its outline; other candidates planned events without composing narrative prose in reasoning. All reasoning responses were read using the prior experiment's drafting definitions.
- **The two cached-Bram cases are useful controls.** Neither arm needed a tool call. Reasoning fell from 376 to 109 tokens and from 552 to 254 tokens. The baseline drafted prose in both, with revisions in the second; the candidate used outlines in both. These pairs support a reduction beyond simply eliminating tool rounds, but remain two observations under a broad prompt ablation.
- **The model improvised instead of retrieving.** In Odette/424244 it explicitly concluded the basic description was enough. That narration placed the scar on the left side instead of the authored right cheek. Ferry/424243 invented a guide chain instead of the authored tar-black rope. The tool description remained available throughout.
- **More room changed the narration.** Several candidates rendered the player's question and both NPC replies at greater length. They also added scene details, player-feature descriptions, and habitual knot tying. The first silent observation introduces knot tying; the second keeps the player's hands still. Whether these choices feel more natural or intrusive is left to the reader.
- **Some constraints survived through context alone.** Both observations remained free of NPC interaction; NPCs did not introduce themselves by name. One narration nevertheless used Odette's name before an introduction, after the separate narrator-knowledge rule had been removed.

[Per-trial review](role-only-review.csv) records the classifications. The complete outputs are the primary artifact for judging style; this note does not declare a subjective winner.

## Controls and interpretation

The [protocol](role-only-protocol.md) preserves all rendered data chips and nonsystem request fields. Only the system instruction surface changes. The candidate has a two-sentence role/perspective instruction plus context, without preparation, formatting, length, language, output, or separate retrieval instructions. Entity descriptions remain summaries except for entries supplied through cached tool history. The tool's own description is unchanged.

The model is `g4-meromero-v2-31b-i1`, thinking enabled, same six scenarios and seeds 424243/424244, same exposed loaded-model metadata, unchanged sampler fields, automatic tool choice, ordinary prose output, 1,024-token response cap, four rounds, four lookups, and 180-second timeout. No failed trial was replaced and no cap was increased.

This removes multiple instruction groups together, including the one-paragraph constraint. It cannot identify whether instruction count, wording, repetition, planning requirements, output length, or their interaction caused the changes. The batch's lower latency and aggregate thinking are also affected by eliminating tool calls. It is a one-model, one-world diagnostic against a cached baseline, not a cross-model or production reliability claim. Application prompts remain unchanged.

## Evidence and checks

- [Raw candidate evidence](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-role-only-batch-2026-09-22T15-41-43-120Z.json), SHA-256 `9e16d07b27a1d25f7dcfa76576a7781ad79291c209b1cbece0883c4ae3ad9187`.
- Batch: **198.879 seconds (3 min 19 sec)**. No inference failures or retries.
- Focused suite: **43 passed in 4.623 seconds**. Shared probe coverage: **96.78% statements/lines, 87.06% branches, 100% functions**. CLI coverage is demonstrated by offline preparation and live inference, not included in those percentages.
- Disabling the role-only branch made the new preservation test fail at its intended assertion in **2.215 seconds**. Source was restored and verified before final checks.
- All twelve actual initial requests matched prepared candidates. All twenty-four complete narrations in the comparison were checked verbatim against raw evidence; review-row totals match this report.
- Harness typecheck passed in **2.205 seconds**, application typecheck in **14.546 seconds**, and lint in **13.527 seconds** (zero errors; existing Fast Refresh warning).
- **The full test gate failed:** 12,547 passed, one failed, three skipped in **86.645 seconds**, exit 1. `SettingsModal.quoteColor.test.tsx` again timed out waiting for Escape to close its popup. This is the same unrelated failure recorded in the [previous experiment](decision-notes-findings.md); no application or color-picker test code was changed. This run was not repeated to obtain a green result. The model experiment and output review are complete, but the code change has not cleared the repository's full done bar.
- Build passed in **17.103 seconds**, retaining the existing bundle-size warning. Changelog copy was reviewed; the sweep found no notices in the edited entry. Export shapes, application defaults, and version were untouched.
- The code graph update completed successfully in **73.253 seconds**. Harness changes remain uncommitted because the full test gate is red.
