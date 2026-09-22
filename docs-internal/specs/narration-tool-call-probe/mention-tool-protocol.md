# Retrieve before mentioning: tool-description probe

Change only the `request_info` description against the saved summary-label batch:

> Retrieve an entity's full authored entry before mentioning it in narration, including indirect references such as “the ferryman.” Entity summaries help you select what to include in the scene. For each selected entity, retrieve its entry unless the full entry is already in context. Supply its name from the entity list.

Keep the minimal narrator prompt, summary labels, context, cached cases, native thinking, schemas, model, seeds, and limits identical. All twelve baseline requests must match their saved requests. Restoring the old tool description must make each candidate request identical to its baseline. Verify loaded-model metadata before inference; preserve failures without retries or cap increases.

Compare six scenarios at seeds 424243 and 424244. Measure action-required lore coverage, completion, lookup counts, reasoning tokens, and narration length. Also manually audit every named or indirect mention of the three listed entities, including incidental background mentions. A trial meets the mention contract only when every mentioned entity has its full entry available before final narration. Cached full entries count as available in this unchanged test.

The intended application design is per-turn retrieval without retaining tool calls across turns. That decision is recorded here but does not change these fixtures or implement retention behavior. This is a one-model diagnostic; application prompts remain unchanged.

Publish all paired narrations separately from thinking and tool calls. Run `node node_modules/vite-node/vite-node.mjs testing/baseline/harness/narration-experimental.cli.ts <summary-label-batch.json> --mention-tool --run`; omit `--run` for offline validation.
