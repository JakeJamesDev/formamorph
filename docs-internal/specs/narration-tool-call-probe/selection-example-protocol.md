# Demonstrated continuation pattern

Compare a short authored example with the saved no-prior-reasoning continuations. Retain the original-reasoning arm as a secondary reference. Reuse the same first model responses, so initial selection and pre-lookup reasoning stay fixed. The two quiet cases have no continuation and are unchanged controls.

On follow-ups only, insert an explicitly labeled demonstration from a separate story after the system message and before the real user action. It contains a user request and entity summary, concise assistant reasoning and native lookup, a full tool result, and concise reasoning applying a new constraint followed by narration. The example uses an observatory archivist and atlas, not any test-world entity or answer. Its reasoning is authored demonstration text, not a rewritten model response.

Omit prior reasoning from the real scene, as in the direct baseline; preserve the demonstration's reasoning. Keep prompts, schema, real tool calls and results, loaded-model metadata, seeds, thinking setting, and caps fixed. Remap all outgoing tool-call IDs consistently. Verify that removing the example and normalizing IDs recovers the exact saved first continuation request.

Inspect productive application of new facts, redundant inventories/plans, duplicate calls, drafting, completeness, entity coverage, action/fact fidelity, and example contamination. Measure post-lookup reasoning without treating lower counts alone as success. Search for Ysra, archivist, observatory, atlas, indigo, and supervised-viewing content; read outputs for subtler borrowing.

This tests the combined example, including its additional context and concise prose. It does not isolate reasoning wording from narration style or establish multi-turn persistence. No production changes, retries, cap increases, or new model tiers. Run `narration-reasoning-replay.cli.ts --example --run` with vite-node.
