# 23: Non-Mention Correction (Server)

Status: ready-for-agent
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Spec Q75 (3): the contribution `POST` accepts a third correction kind, `nonMention`, for a link the player marked as not a person.

- **Submit:** `CORRECTION_KINDS` gains `nonMention`. Its `entityId` must be null; any other value is refused (400).
- **Export:** a `nonMention` removes its span from every cluster, exactly as a mention corrected to null does today. The annotation format is unchanged.
- **Queue:** the queue returns it like the other kinds.
- **Deploy:** this lands and deploys before ticket 24.
- **Changelog:** none (staff tooling).

## Acceptance criteria

- [ ] A submit with a `nonMention` correction is stored, and the queue returns it. A `nonMention` that names an entity is refused.
- [ ] The export of a row with a `nonMention` is byte-identical to the same row with a null `mention` correction on that span.
- [ ] Existing contributions and their export are unchanged.
