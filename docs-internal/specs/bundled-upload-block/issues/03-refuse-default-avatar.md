# 03: Refuse the default Avatar on publish

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: one more refusal inside an existing publish-attempt function with existing tests.

## What to build

A player tries to publish the default Avatar from the Model Library, under its seeded entry or as a re-imported copy under a new name. The publish dialog does not open. A toast says: "This is the default avatar. Upload your own VRM." Any other model reaches the license gate as today.

## Acceptance criteria

- [ ] The Avatar publish attempt refuses a model whose stored byte hash equals the seeded default model's byte hash.
- [ ] The check runs before the license gate.
- [ ] Refused: the seeded default, and the same bytes stored under a new id.
- [ ] Allowed through to the license gate: any other model.
- [ ] Tests extend the existing Avatar publish-attempt tests. Each guard is proven to bite.
- [ ] Changelog In-Progress entry. Four gates green.
