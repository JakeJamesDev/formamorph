# Retrieve before planning portrayal

Replace the inclusion description's first Use when sentence with:

> Once you identify an entity to include, retrieve its full entry before planning its portrayal, unless already loaded for this response.

Keep Purpose, the remaining scope instructions, Input, Output, system prompt, expanded fixture, six actions, seeds, thinking, schema, model metadata, and limits unchanged. Use the preceding inclusion candidate as the cached control; retain the earlier original control for secondary comparison. Verify complete cached request equality before running twelve new candidates. This is an ordering-sentence comparison, not a larger reasoning checklist.

Primary measures are pre-lookup and post-lookup reasoning tokens across the ten action-required retrieval cases, alongside required retrieval and mention coverage. If a candidate skips a needed lookup, report it as a failure rather than treating zero pre-lookup tokens as an efficiency gain. Report quiet-observation cases separately because a lookup is contingent on the entities narrated. Inspect traces for planning before fetching and summary-sufficiency deliberation; do not infer causation from traces alone.

Use the established entity-mention and factual-review rules. Keep every narration and thinking response in separate artifacts. No retries or cap increases, no production prompt changes, and no broader reliability testing. Run `narration-selection.cli.ts --retrieve-first --run`.
