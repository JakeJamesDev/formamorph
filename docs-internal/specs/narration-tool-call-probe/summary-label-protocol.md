# Entity summary label probe

Change only the entity listing field label from `description` to `summary`. Preserve the minimal role-and-perspective instruction, chip values and order, tool description, cached lore, model, thinking mode, sampler fields, limits, and player actions. Application prompts remain unchanged.

Compare all six scenarios at seeds 424243 and 424244 with the saved role-only batch. Validate the complete cached baseline requests and reverse the three label substitutions to prove candidate request equality before inference. Verify loaded model metadata matches the baseline. Run only the candidates; preserve failures without retries or cap increases.

Measure required lore retrieval, unnecessary or repeated lookups, completion, reasoning tokens, narration length, and batch duration. Publish every paired final narration separately from thinking and tool calls. Prose quality remains a subjective review. This is a same-model diagnostic, not cross-model release validation.

Run with `node node_modules/vite-node/vite-node.mjs testing/baseline/harness/narration-experimental.cli.ts <role-only-batch.json> --summary-label --run`. Omit `--run` to validate requests offline.
