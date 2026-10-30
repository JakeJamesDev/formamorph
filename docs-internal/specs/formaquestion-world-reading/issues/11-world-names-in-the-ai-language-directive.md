# 11: World Names in the AI Language Directive

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a prompt-text change with a probe.

## What to build

"Keep world names as the world writes them" lives only in the two world rules prompts. A player who edits or clears them loses it. The AI Language directive carries the rule whenever a world block is sent, as it does for control names from the guide. A request with no world block is byte-equal to today's.

Found in the close review. Spec: "The AI Language directive keeps world names as the world writes them."

## Acceptance criteria

- [x] With an AI Language set and a world block sent, the directive keeps world names (`the AI Language with a world block` in helpSession.editorWorld.test.ts: rules cleared, empty block; the game test `keeps world names in the AI Language directive`; each fails when the flag is inverted)
- [x] With no world block, the body is byte-equal to today's (`sends the AI Language body of today with no world block`: the whole system prompt against the literal earlier text)
- [x] A probe run with a non-English AI Language on a few world cases, recorded in the ticket (Probe below)

## Probe

`world-question-probe.cli.ts -- --language Spanish`. Cloud `default` (root gemma_deploy). Four cases (editor: veil-raptor, sugar-saltlick; game: veil-what-moths, val-who-coach), each asked in Spanish. Every arm runs in one batch. Facts take Spanish or English wording. **Names kept** = the answer writes every world name of the case as the world writes it. Both world rules prompts are cleared in the `rules-cleared` arms, so only the directive keeps names there.

**Batch 1** (5 runs, first wording "Keep each name from the world exactly as the world writes it."): names kept, rules-cleared vs control (sentence stripped): editor 50% vs 40%, game 30% vs 20%. That is noise. Shipped with the world rules on: editor 60%, game 90%.

**Batch 2** (10 runs, 120 questions, 0 failed): the firmer wording, now shipped.

| lean | first wording | firm wording | control (no sentence) |
|---|---|---|---|
| editor (n=20) | 45% | **70%** | 35% |
| game (n=20) | 40% | **50%** | 20% |
| facts, editor / game | 95% / 65% | 95% / 63% | 80% / 65% |

Firm vs control pooled: 24/40 vs 11/40 (z ≈ 2.9). It leads in each of the four cases. Its answers often add a Spanish gloss beside the kept name.

## Landed

**Not verified**
- None.

**For you**
- A Spanish answer can now carry the world name with a gloss, such as "Lantern Moths (polillas linterna)". Ask Formaquestion in game with AI Language set to Spanish, and judge whether that reads well.
