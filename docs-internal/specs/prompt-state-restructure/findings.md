# Prompt State Restructure — Parked (Experimental)

**Status: `ready-for-human`** — needs a new strategy before any re-attempt.
**The full implementation lives on branch `prototype/prompt-state-restructure`** (commit `e21cd54`), removed from `main` 2026-08-29. Restore it in GitHub Desktop: Branch menu → `prototype/prompt-state-restructure`.

## What the branch contains

| Piece | Where |
|---|---|
| Default templates: `## Current Scene` block in the narration user message | `src/components/game/GamePrompts.ts` |
| Chip resolution in the narration user template (additive capability) | `promptVariables.ts`, `turnPasses.ts`, `narrationPrompt.ts`, `dictionaryScan.ts` |
| Request-build seam tests (10 cases, mutation-proven) | `src/lib/turnPipeline/narrationRequest.test.ts` |
| Grounding probe + cases, incl. system-adherence metrics | `testing/baseline/harness/grounding-probe.mjs`, `testing/baseline/grounding-cases.json` |

All four gates were green on the branch. No export-shape change.

## Probe results (why it looked like a win)

Eight-turn chains, arms differing only in the two templates:

| | Cydonia A→B | cloud A→B |
|---|---|---|
| Scene's own detail in prose ↑ | 90→95% | 52–60% → 71–86% |
| Standing note honored ↑ | 27→34% | 7–10% → 13–15% |
| Quoted dialogue | ~even | 26→20% ⚠️ |
| System-rule violations (name leak, person, markdown, stat dump, world fact) | even or better | even or better |

Stats-split arm (C) and action-first arm (E) both measured worse than B. Summary-sized blocks (D) recover most cloud dialogue at a grounding cost.

## Why it's parked: live play contradicts the probes

Real sessions showed **general system-prompt weakening** the probe corpus missed:

1. **Language directive dropped often.** `<LANGUAGE>` sits at the system-prompt tail; the move stacked ~1.5–1.9k chars of English state between it and generation. Worst on the opening turn — register lock means an English turn 1 never recovers, because all history reads English from then on. Every probe runs English-only (`grab()` strips the chip), so this was structurally invisible.
2. **Cydonia ends turns with "What will you do?"** — the ending contract, despite LEAK measuring 0% in the probe.
3. **Paragraph limits respected less often** — length guidance was never a probe metric.

Common cause: the probes measured what the *moved* blocks gained, and only five hand-picked system rules. The live failures are in system-prompt contracts the corpus never stressed (one world, thinking-off, short chains, no language setting).

## Open problems for the next strategy

- The system prompt's *contracts* (output format, ending, length, language) need recency as much as the state does — moving state down pushed them further up. A strategy that moves state must decide where the contracts go.
- `<LANGUAGE>` cannot even be authored into the user message today (not offered, value not in the render map). Any re-attempt should fix that first and probe language explicitly (extend `language-probe.mjs` to compose through the real assembly; cloud tier decides — Cydonia ignores the directive regardless).
- Probe corpus needs: language arms, per-limit paragraph counts, longer sessions, more worlds, and the planning lanes before any ship call.
