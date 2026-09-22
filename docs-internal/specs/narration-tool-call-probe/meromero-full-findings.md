# Full Narration Prompt: MeroMero Comparison

## Result

The loaded `g4-meromero-v2-31b-i1` model completed **2/2 minimal trials and 4/4 full narration trials** with native tool calls. Every full trial requested Bram and Odette together, received their descriptions, then submitted narration through `write`. No ordinary assistant prose substituted for a tool call.

The earlier Rocinante full batch made no native calls in four trials. Comparing the saved initial requests confirms **identical messages and tool schemas for all four corresponding cases**. This supports a model/configuration-dependent compliance issue rather than an inherently incompatible full prompt. It does not separate model weights from chat-template or server configuration differences, or prove the prompt cannot be improved for Rocinante.

## Controls and settings

The loaded model ID differed from the previous `g4-meromero-31b`, so the minimal baseline was repeated on the current version before running the full batch. Both used the existing harness unchanged: automatic tool choice, seed `424242`, 1,024 output tokens, `reasoning_effort: "none"`, non-streaming responses, three minutes per request, and matching nine-character IDs on outgoing local history. Temperature and repetition penalty remained omitted.

Full cases were two repetitions of greeting both characters, followed by two repetitions of crouching to study the water. The latter permits direct `write` if no entity needs portrayal; it does not prohibit introducing an entity after retrieval.

## Observations

| Case | Requests | Lookups | Native write | Trial duration | Total tokens |
|---|---:|---:|---|---:|---:|
| Minimal 1 | 2 | 1 | Yes | 2.326 s | 487 |
| Minimal 2 | 2 | 1 | Yes | 2.038 s | 490 |
| Main 1 | 2 | 2 | Yes | 9.371 s | 3,114 |
| Main 2 | 2 | 2 | Yes | 7.921 s | 3,114 |
| Control 1 | 2 | 2 | Yes | 6.412 s | 3,046 |
| Control 2 | 2 | 2 | Yes | 6.299 s | 3,046 |

The main outputs correctly used Bram's right hand and brass ring, Odette's green glass bead and twice-counting habit, and dialogue from both characters. Neither character's unintroduced name leaked into narration. Outputs were single paragraphs. The two main outputs were identical, as were the two controls, so this is a small repeated-input smoke test, not evidence of broad reliability.

Representative retrieved-fact use:

> “I pull the ferry,” he says, his right hand working the hemp with practiced ease. “I don't cross after dark.”

> She glances at you, her eyes quick and assessing, before she turns back to count the smoking fish for the second time.

Both controls introduced Odette and used her bead and counting details. Both also retrieved Bram despite not portraying him. Retrieval selectivity therefore remains a question: this run demonstrates successful access to lore, not efficient selection of only needed lore. The main narration's references to a “listing raft” and waiting “for the tide” are generated elaborations, not facts supplied by the retrieved descriptions; protocol success is not a complete canon-quality verdict.

## Timing and evidence

The minimal batch took **4.365 seconds** (CLI **18.078 seconds**). The full batch took **30.003 seconds** (CLI **43.795 seconds**), with 11,440 prompt tokens and 880 completion tokens, **12,320 total**. No model requests timed out. No verification suite or build ran alongside these batches.

- Source: `c77b3359`; no code or prompt edits for this comparison.
- [Minimal transcript](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/minimal-batch-2026-09-22T11-36-27-999Z.json), SHA-256 `86de87d456eb6ee75c9761d6a0f5f127944896f84f4ffb0a6f98f68bf7286431`.
- [Full transcript](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/lm-studio-batch-2026-09-22T11-37-11-791Z.json), SHA-256 `5ff6c7b87c4c9b00737737b78be154afad13131bc2338b2f9ec786275f3ae0b5`.
- [Rocinante full results](local-findings.md) and [minimal comparisons](minimal-findings.md).

Raw transcripts remain local, gitignored artifacts. The existing harness was executed without modification; no new code required gate reruns.
