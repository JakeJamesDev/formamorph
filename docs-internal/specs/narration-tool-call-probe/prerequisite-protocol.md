# Explicit retrieval prerequisite

Compare the saved [preparation-goal batch](preparation-goal-findings.md) with a candidate that changes exactly one sentence:

> Before portraying any listed person or object, call request_info for its full entry unless that full entry is already in context.

This replaces “When a needed entry is missing, request it before composing the scene.” All other preparation wording and prompt content remain identical. The rule explicitly names the tool and makes portrayal, rather than the model's judgment of information sufficiency, the retrieval condition. The experiment cannot distinguish those two effects from each other.

Run the same six scenes at seeds 424243 and 424244 on the same loaded MeroMero model. Keep ordinary narration, thinking enabled, automatic tool choice, the single-string lookup schema/description, 1,024 response tokens, four rounds, four lookups, and 180 seconds per request. World data, actions, cached descriptions, and omitted sampler fields remain unchanged.

Before inference, verify fresh baseline requests against saved requests and loaded-model metadata against the saved inventory. Candidate requests must match after restoring only the changed sentence. Stop on infrastructure failure; preserve every trial, including failures, without replacement runs or budget increases.

Use the [ordinary-output scoring rules](plain-output-protocol.md). Primary diagnostic: missing-lore trials retrieving all required entries, plus completed narration with full entries available for required and substantively portrayed entities. Also report delivery, malformed/unmatched/redundant calls, unnecessary retrieval, restraint, formatting, canon issues, drafting, tokens, and time. Read all delivered narrations and failed final traces. The two cached-Bram and two environment scenes remain negative controls for unnecessary retrieval.

Run `node node_modules/vite-node/vite-node.mjs testing/baseline/harness/narration-experimental.cli.ts <saved-preparation-goal-batch.json> --prerequisite --run`. Omit `--run` for offline preparation. Application prompts remain unchanged. Results are a cached comparison on one model and one world, not broad validation.
