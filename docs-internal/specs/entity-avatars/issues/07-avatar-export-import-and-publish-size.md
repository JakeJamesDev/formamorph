# 07: Avatar Export, Import and Publish Size

Status: ready-for-agent
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: embed and dedupe on two file paths, plus two size checks against known server limits.

## What to build

An exported character card or entity listing carries the library Avatar its author picked, embedded in the file (spec: Entity pick; Q23 reopened). Picks of none or user's default export as they are. Importing an entity file that carries an Avatar adds it to the Avatar library, reusing an existing record with the same content hash, and rewrites the pick to that library id. Publishing an entity listing checks its size, Avatar included, against the server's 25 MB entity limit. Publishing a world checks its store against the 100 MB world limit. Both checks run before upload.

## Acceptance criteria

- [ ] A card export of an entity with a library Avatar pick contains the Avatar file; none and user's default export unchanged.
- [ ] Importing that card twice adds one library record (same hash) and points both picks at it.
- [ ] Entity and world publish refuse an over-limit upload before sending, with a message that names the size.
- [ ] Tests cover export, import with dedupe, and both size checks.
- [ ] Changelog fragment.
- [ ] Export-shape reminder in the landing: character cards and entity listings carry the pick and the embedded Avatar.
