# Include entities in upcoming narration

Test the approved Purpose and Use when wording against the saved control on the expanded selection fixture. Purpose tells the model that summaries help choose entities; Use when requires full entries before inclusion, covers direct/indirect references and background appearances, and leaves unrelated entries unfetched.

Keep Input, Output, tool schema, system prompt, fixture, actions, model, seeds, thinking, and limits unchanged. Compare against saved arm A from the selection-scope batch after complete request equality and loaded-metadata checks. Run twelve new candidate trials; retain all twelve cached controls. The preceding arm B remains a secondary descriptive comparison on the same fixture.

Use `narration-selection.cli.ts --include --run`. Preserve failures without retry or cap increases. Apply the same mention, relevance, and factual-review method as the [selection-scope protocol](selection-scope-protocol.md). Keep all narration separate from thinking and clearly label the cached control. This tests the combined wording change, not the isolated word “include.” Application prompts remain unchanged.
