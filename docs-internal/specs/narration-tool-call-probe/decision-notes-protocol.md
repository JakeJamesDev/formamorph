# Decision notes preparation experiment

Compare the saved [explicit retrieval prerequisite batch](prerequisite-findings.md) with the approved positive preparation contract. Replace only the preparation section, keeping its exact retrieval rule:

> Use preparation to choose the scene's immediate outcome and identify the authored facts needed to portray it. Keep preparation in brief decision notes: participants, relevant facts, and what changes.
>
> Before portraying any listed person or object, call request_info for its full entry unless that full entry is already in context.
>
> Preparation is complete when those entries are available and the immediate outcome is chosen. Move directly to the final narration, composing the scene's wording there.

Run the same six scenarios and two seeds (424243/424244). Preserve the model, thinking, ordinary narration, lookup schema and description, cache, world, actions, omitted sampler settings, 1,024 response tokens, four rounds, four lookups, and 180-second request timeout. Verify fresh baseline requests against saved requests, unchanged fields outside preparation, and matching loaded-model metadata before inference. Stop on infrastructure failure; preserve failures without replacement runs.

Primary comparison: repeated prose drafting inside reasoning, completed narration, and completion with full lore available for required and substantively portrayed entities. Repeated drafting means composing scene prose and then rewriting it or producing another prose version before the final answer; a brief event outline alone does not qualify. Review every response's reasoning in both arms using this definition. Report reasoning tokens and latency, required-entry retrieval, unnecessary/redundant calls, restraint, paragraphs, and qualitative prose regressions. Keep all four controls. Fewer reasoning tokens alone is not success.

This is one model and one world, not cross-model validation. Application prompts remain unchanged.

Run `node node_modules/vite-node/vite-node.mjs testing/baseline/harness/narration-experimental.cli.ts <saved-prerequisite-batch.json> --decision-notes --run`. Omit `--run` for offline preparation.
