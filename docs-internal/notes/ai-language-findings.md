# AI Language directive — probe findings

Evidence behind the change that turned the AI Language setting's prompt line from a label into an
imperative sentence, and moved narration's copy to the end of the system prompt.

Probe: [language-probe.mjs](../testing/baseline/harness/language-probe.mjs) · run 2026-08-17.

## What was compared

| arm | narration | choices |
|---|---|---|
| **label** (before) | `Narration language: X`, appended **before** the backward-compat lore block | `Choice language: X` |
| **imperative** (after) | `Write all narration in X.`, appended **after** everything, so it is the last line | `Write all choices in X.` |

Both arms fire the real `defaultSystemPrompt` / `defaultChoicesPrompt`, filled from the tracked
planning-cases fixture, with a two-entry lore block appended — the burial the placement change fixes. The
turn is chained as the game chains it: narration first, then choices over that narration.

**Metric:** is the text in the target language, by exclusive function-word counts (a word appears in at most
one language's set, so shared tokens can't tip it). Near-ties stay unclassified rather than being guessed.
The probe self-checks the scorer against three known passages before reporting anything.

## Cloud default endpoint (`cooperdk/gemma-4-E4B-it-heretic-GPTQ-4bit`) — 12 runs per arm

| target | arm | narration in target | choices in target | both | flagged |
|---|---|---|---|---|---|
| French | label | **0%** | 25% | 0% | 0 |
| French | **imperative** | **100%** | **100%** | **100%** | 0 |
| Spanish | label | **0%** | 0% | 0% | 0 |
| Spanish | **imperative** | **92%** | 50% | 42% | 0 |

Decisive on the tier most players actually hit: 0/12 → 12/12 for French narration, 0/12 → 11/12 for Spanish.
Spanish choices lag narration, so the whole turn lands in Spanish 42% of the time — the choices pass is the
weaker of the two, not the narration.

## Cydonia 24B (local, q4_k_m) — 3 runs per arm

| target | arm | narration in target | choices in target | both | flagged |
|---|---|---|---|---|---|
| French | label | 0% | 0% | 0% | 0 |
| French | **imperative** | **0%** | **100%** | 0% | 0 |
| Spanish | label | 0% | 0% | 0% | 0 |
| Spanish | **imperative** | **0%** | 0% | 0% | 0 |

**Cydonia never writes non-English narration, under either wording or placement.** The choices pass does
respond to the new directive (0% → 100% for French), so the model can write French — it just won't do it for
narration. The difference between the two calls is that narration carries prior English story turns as
assistant messages and choices does not: the in-context English wins over a system-prompt instruction.

## What this means

- The wording + placement change is the whole available win on the system-prompt channel, and it is a large
  one on the cloud tier.
- A local-model report of "it still narrates in English" is a **model** issue, not a prompt issue. That is now
  a measured claim, not a guess.
- The next lever, if it is ever wanted, is echoing the language on the **per-turn user message** rather than
  only the system prompt — the same recency argument, applied to the channel that is actually beating the
  system prompt on Cydonia. Deliberately not part of this change.

## Regression check

Zero flags in every cell of both tiers: no run offered the player choices inside the narration and none
tabulated stats. The format contract survived the change on both tiers, in both languages.
