# Remove the fixture-specific tool example

The previous tool description included “the ferryman,” a role present in the test world. This could cue retrieval for that fixture and limits interpretation of the previous results. Preserve that evidence, and isolate removal of the example before changing any other definitions.

Replace only `including indirect references such as “the ferryman.”` with `whether by name or indirect reference.` in the lookup description. Keep the minimal narrator prompt, single entity definition, summary labels, cached cases, tool schema, model, seeds, and request limits unchanged. Do not add definitions for other sections.

Compare all twelve candidates against the saved entity-definition batch. Validate reconstructed baseline requests and prove complete candidate equality after restoring only the original tool description. Verify loaded-model metadata. Run each candidate once, preserving failures without retries or cap increases.

Measure required retrieval, completion, all-mention coverage using the prior manual audit rules, thinking tokens, and narration length. Publish all narration pairs separately from thinking. This tests the effect of removing the example in the same world; it does not establish generalization to other worlds or models.

Run the experimental CLI with the entity-definition batch and `--no-example --run`; omit `--run` for offline validation. App prompts and per-turn retention behavior remain unchanged.
