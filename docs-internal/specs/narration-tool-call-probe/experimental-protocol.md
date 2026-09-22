# Experimental prompt comparison

Compare the built-in Experimental narration prompt against the Default prompt adapted for tools. Use the existing [six scenarios and scoring rules](expanded-description-protocol.md), with seeds 424243 and 424244 selected before inference. Run all twelve Experimental trials; reuse the matching twelve information-focused-description (B) trials from the saved description batch.

Keep the clearer lookup description, single-string `term`, automatic tool choice, thinking enabled, 1,024 response tokens, four rounds, and 180-second request timeout. Retain the same world, summaries, actions, cached lore, and model. Experimental supplies its own preparation/output instructions and bare-action user message; do not append Default's probe-specific instruction block to it.

The runner verifies that freshly prepared Default requests equal their cached counterparts, and that Experimental differs only in the system and user messages. It also requires loaded-model metadata to match the cached inventory. Server sampler defaults not present in that metadata remain an uncontrolled variable; this is a cached, sequential comparison, not a newly interleaved batch.

Report native completion, required and portrayed lore availability, response-cap failures, malformed calls, silent-observation restraint, repeated retrieval, paragraph count, and task fulfillment. Inspect failed response traces for repeated drafting even when they never reach `write`. Keep every failed trial in the denominator. Stop on infrastructure failure and preserve partial evidence; do not retry or increase the cap.

Run with `node node_modules/vite-node/vite-node.mjs testing/baseline/harness/narration-experimental.cli.ts <saved-description-batch.json> --run`. Omit `--run` for offline preparation. Raw paired requests, cached responses, new responses, and timings are saved under `testing/baseline/runs/narration-tool-call-probe/`.

This is a diagnostic on the loaded MeroMero model, not cross-model validation or a test of the tool-free gameplay path.
