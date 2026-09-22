# Three-turn demonstration comparison

Compare the existing concise example (A) with a revised select → retrieve → apply example (B). The revised example retrieves a focal character and a background creature, leaves an unused courier unfetched, and applies both returned entries in its narration. All demonstration entities belong to a separate story.

## Fixed conditions

- Local loaded MeroMero, checked against the preceding run’s complete model metadata. Thinking enabled.
- Two seeds: 424243 and 424244. Each chain keeps its seed for every request.
- Three actions per chain: seek a healer, quietly observe water/planks, seek a cobbler. Both arms run live; 12 player turns total.
- Same minimal role, section definitions, summaries, `get_entity(name)` description, sampler settings, 1,024 output-token cap, four-request/four-lookup budgets, and three-minute request timeout.
- Both examples appear from the first request and remain in context. This differs from the earlier continuation-only experiments, so their saved responses are not used as baselines.
- Between player turns, retain only actual user actions and final narration. Discard real tool calls, results, and reasoning. Within a turn, retain tool exchanges but omit previous real reasoning from requests. Keep authored demonstration reasoning.
- Alternate A/B order by seed. No retries or increased caps for failed trials.

## What this can establish

This is a small transcript-chain experiment with static world chips, not a full gameplay simulation. Later narration histories differ between arms. The example changes length, entity count, selection, and output together; any effect belongs to that package. Keeping the example in context does not test whether its influence persists after removal.

Review all entities that appear in narration, including indirect and background references. Report ambiguous collective references separately. A previous turn’s lookup does not satisfy this turn’s requirement. Score target selection, unnecessary lookups, factual departures, and example leakage alongside reasoning length.

Read reasoning for useful selection and application of new information versus repeated plans, redundant inventories, prose drafts, and duplicate lookups. Token totals alone cannot make this distinction.

## Evidence

- [Exact prompts and message assembly](selection-chain-prompt.md)
- [Narration only](selection-chain-outputs.md)
- [Thinking only](selection-chain-thinking.md)
- [Findings](selection-chain-findings.md)

Runner: `testing/baseline/harness/narration-example-chain.cli.ts --run` through vite-node. Raw requests and responses are saved incrementally under `testing/baseline/runs/narration-tool-call-probe/selection-chain-batch-*.json`.
