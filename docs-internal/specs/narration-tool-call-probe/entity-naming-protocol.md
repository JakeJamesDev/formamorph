# Entity vocabulary alignment

Test two independent twelve-case variants against the saved section-definitions batch:

1. **Header only:** rename `Characters and Things That May Appear in This Location` to `Entities in the Current Location`.
2. **Tool name only:** rename `request_info` to `get_entity`, including the supplied cached calls so that their names remain consistent. Preserve their arguments and results.

Retain `term` in both variants. Keep descriptions, definitions, summaries, full-entry data, model, seeds, thinking, limits, and case actions fixed. Reverse only the intended rename and verify complete request equality before inference. Verify loaded model metadata and preserve every response without retries or cap increases.

If naming maintains or improves retrieval, test `get_entity(name)` against the saved `get_entity(term)` batch. Change only the schema property/required key, supplied cached-call argument key, and corresponding dispatcher key. Keep tool-result payloads unchanged. Validate real lookup execution offline before inference. Do not combine the header change with this comparison.

Compare required retrieval, every-mention coverage, completion, syntax failures, reasoning tokens, and output length. Publish narration separately from thinking. The conditional parameter step is justified when required retrieval and completion do not regress, and mention coverage does not regress; otherwise report the tradeoff before extending the run. Small same-world samples do not establish generalization.

Use the existing experimental CLI with `--entity-header`, `--entity-tool`, or `--entity-parameter`, and append `--run` for inference. Header/tool modes take the section-definitions batch; parameter mode takes the tool-name batch. Application prompts remain unchanged. Docstring-style descriptions are a separate possible experiment and are not part of these comparisons.

## Later description-format comparison

Compare paragraph and labeled docstring forms with equivalent information, including Purpose, Use when, Input, and **Output**. The user specifically requested Output. Describe the existing `{ matches: [{ id, name, description }] }` response, including an empty list when no entry matches; descriptions depend on authored data. Do not change result payloads as part of that formatting test or add fixture-specific examples.

[Anthropic's tool guidance](https://www.anthropic.com/engineering/building-effective-agents) recommends clear docstring-style documentation. It does not establish this roleplay model's preference. Test that preference separately after naming; no format comparison is run here.
