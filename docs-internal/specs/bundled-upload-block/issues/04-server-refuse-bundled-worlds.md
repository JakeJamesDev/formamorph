# 04: Server: refuse bundled worlds

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a second implementation of the fingerprint that must agree exactly with the client's, plus route wiring on publish and update.

Workplace: the FormamorphServer repo. Its spec is `docs-internal/specs/bundled-upload-block/spec.md` there.

## What to build

An old client, or a player with a duplicated bundled world, publishes it. The server refuses with a 400 and the message "This is a bundled world. Edit it to make it your own, then publish." Nothing is stored. An update that replaces a listing's content with a bundled world is refused the same way. A world with real text edits is accepted.

## Acceptance criteria

- [ ] The server fingerprint function returns the shared test vector's expected value from ticket 01.
- [ ] The fingerprint list file from ticket 01 is copied in, and loaded once at startup into a set.
- [ ] The publish route refuses a world kind listing whose fingerprint is in the set, before storing anything.
- [ ] The update route applies the same check to new content.
- [ ] Route tests use a test list built from a small fixture world: refused on match, accepted after one long text value changes, ordinary worlds accepted.
- [ ] Each guard is proven to bite. Server test suite green.
