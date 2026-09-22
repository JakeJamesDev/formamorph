# Upcoming narration and character selection

Compare the current labeled tool description (A) with an upcoming-narration trigger (B). Only the Use when line differs. Both use the minimal narrator prompt, section definitions, entity header, `get_entity(name)`, and Output documentation.

Build an additive variant of Sedge Landing with six NPCs and the ferry. Add a healer, cobbler, basketmaker, and courier, each with a summary and a withheld full description. Keep the ferry and its existing summary and location reference. Move the river-setting sentence from System Prompt Addition to Current Location; retain tone and global rules in the addition. Both arms get the same revised fixture. This is not comparable directly to old-world success rates.

Run six actions twice per arm: greet the ferryman and eel-smoker, inspect the eel-smoker, inspect the ferry, quiet water/dock observation, find help for a cut, and find help for a damaged boot. The final two require selecting the healer/cobbler from summaries. The basketmaker and courier are distractors relative to these actions, but naturally mentioning them is not itself a failure. No cached entries are supplied in either arm. These selection cases replace the old cached-lore controls for this focused experiment.

Use the same loaded local model and metadata, seeds 424243/424244, thinking, sampler fields, caps, and transport as the preceding run. Alternate arm order within pairs. Run 24 trials with no replacement retries or cap increases. Complete request comparison must show only the description differing.

## Review

- Required retrieval and choosing the appropriate professional in the narration.
- Every-mention coverage; count unique mentioned entities per narration, separating people and objects.
- Mentioned entries loaded/missed and loaded entries not used in narration. Calls for background participants are not automatically irrelevant calls.
- Explicit contradictions against full authored facts, separately for loaded/unloaded entities. Unsupported embellishments are not automatically contradictions; omit ambiguous judgments or mark them uncertain.
- Completion, invalid calls, thinking tokens, and length. Preserve every narration and thinking trace separately for subjective review.

Collective references count conservatively, with an alternative score excluding ambiguous collective mentions. These small paired trials diagnose the specified behavior; broader model, world, and session reliability are out of scope.
