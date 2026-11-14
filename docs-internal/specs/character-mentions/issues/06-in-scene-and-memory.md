# 06: In Scene and Memory

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Mention Reading feeds In Scene, the diary passes and memory.

- **In Scene:** `readNarration` takes the turn's reading when it exists.
  - Entities with a linked mention in the prose, outside quoted speech, join the participant union. They count for In Scene and get diary and discover work.
  - The reading only adds participants. It never removes a name-based one.
- **Met:** stays name-based. A pronoun or descriptor never makes an entity met.
- **Memory input:**
  - A bracketed view of the narration ("she [Mira] left") is the input to the digest, diary and milestone passes only.
  - A pass that runs before the reading exists reads the plain text.
- **Leaks:** brackets never reach the display text, the narration prompt history, read-aloud, choices, exports or the Narration Stream.
- **Changelog:** a fragment for the feature.

## Acceptance criteria

- [ ] An entity shown only by pronoun joins In Scene and gets a diary pass. Tests run through `readNarration` with a fake reading.
- [ ] A pronoun-only mention of an unmet stranger does not make the stranger met.
- [ ] Digest, diary and milestone inputs carry bracketed names when a reading exists, and plain text when it does not.
- [ ] Leak tests: with a reading present, no bracket appears on any non-memory surface listed above. Each leak test is proved by reinstating the leak.
- [ ] With the feature off, participants and memory inputs are identical to today.

For you: in one playthrough, compare a few memory summaries with and without the feature.
