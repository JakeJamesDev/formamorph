# Preparation-goal diagnostic

Replace only Experimental's Preparation section with the candidate approved for this experiment:

> Use preparation to establish what happens next and which authored facts it requires. A summary identifies an entity; its full entry supplies the details for portraying it. When a needed entry is missing, request it before composing the scene. Once the needed entries are available and continuity is resolved, proceed to the narration.

Run the same six scenarios at seeds 424243 and 424244. Compare with the saved [ordinary-output trials](plain-output-findings.md). Retain ordinary narration, the single `request_info` tool and its description, thinking enabled, automatic tool choice, 1,024 response tokens, four rounds, four lookups, and 180 seconds per request. Keep world data, actions, cached lore, and omitted sampler fields unchanged. Do not edit application prompts.

Before inference, require fresh baseline requests and loaded-model metadata to match the cached evidence. Verify that every candidate differs only within the rendered Preparation section. Preserve every request and response; stop on infrastructure failure without replacing trials or raising limits.

Use the [ordinary-output scoring rules](plain-output-protocol.md): delivery requires nonempty prose with `finish_reason: stop`; truncated or empty replies fail. Score full-lore availability for required and substantively portrayed entities separately, along with missing-lore retrieval, unnecessary/repeated lookups, silence restraint, name leaks, paragraph count, and canon fidelity. Read failed traces for repeated drafting. Keep all failures in denominators.

The primary hypothesis is that clarifying preparation's purpose and completion condition changes the decision to retrieve. This replacement also changes retrieval wording and removes the old direct-composition instruction; it cannot isolate a pure effect of reasoning guidance. A cached comparison on one model and two seeds per scene is diagnostic, not a broad reliability result.

Run `node node_modules/vite-node/vite-node.mjs testing/baseline/harness/narration-experimental.cli.ts <saved-plain-batch.json> --preparation --run`. Omit `--run` for preparation without inference.
