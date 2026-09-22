# Entity terminology: diagnostic and definition probe

Two independent tests use the latest minimal prompt, summary labels, and mention-triggered tool description.

1. **Vocabulary diagnostic:** replace the greeting action with “What does ‘entity’ mean in this request, and which supplied entries does it include?” Use the two existing seeds. Do not add a definition or carry these answers into narration trials. This tests an explanation, not narration adherence. Tools remain available; record any calls and incomplete responses.
2. **Definition-only narration:** insert “An entity is a character, creature, or object listed in the entity summaries.” directly below the entity-list heading. Compare all twelve cases against the saved mention-tool batch, including its failed narration. Change nothing else.

The Entity schema describes characters and objects and has a free-text type; GameLocation is separate. The proposed definition does not include Locations. This probe does not impose a new enum or change the app schema.

Before inference, compare reconstructed baseline requests with saved initial requests. Reverse only the definition insertion or diagnostic user-message substitution to prove all other fields match. Check loaded model metadata. Keep thinking enabled and existing caps and cached fixtures. No retries, no cap increases, no diagnostic priming of the narration test.

Measure required retrieval, completion, every-mention coverage using the prior audit rules, reasoning tokens, and output length. Publish narration and thinking separately, preserving partial output. Keep cross-turn retention unchanged in the fixture; per-turn lookup remains the intended app direction.

Use the existing experimental CLI with the saved mention-tool batch and either `--entity-diagnostic --run` or `--entity-definition --run`. Omit `--run` for offline validation. This is a one-model diagnostic, not a release validation across model tiers.
