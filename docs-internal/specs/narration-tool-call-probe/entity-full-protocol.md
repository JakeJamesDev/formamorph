# Combined entity tool experiment

Following review of the independent naming results, the user authorized testing the full package. Compare the saved section-definitions baseline against these combined changes:

- Header: `Entities in the Current Location`.
- Function and parameter: `get_entity(name)`.
- Description: labeled Purpose, Use when, Input, and Output, including the actual response fields and empty-match behavior.

Keep entity data, all section definitions, minimal narration role, actions, cached-entry fixtures, loaded model metadata, seeds, thinking, sampler settings, and completion limits unchanged. Use all six existing scenarios at both seeds. Reverse the intended changes and check full request equality before inference. Preserve failures without retries or cap increases.

Measure required retrieval, completion, every-mentioned-entity coverage, invalid calls, thinking tokens, and narration length. Publish all narration and thinking separately. This measures the combined package against the baseline; it does not isolate documentation style or the effect of Output. A future formatting comparison would need equivalent content in both arms.

Run the experimental CLI with the section-definitions batch and `--entity-full --run`. Application prompts remain unchanged. This is a local-model experiment, not cross-model release validation.
