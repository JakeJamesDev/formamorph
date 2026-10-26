# 20: Keep Shipped Fingerprints

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q22, Q23; Implementation Decisions › Ship-time re-encode)

## What to build

The bundled fingerprint generator records the shipped form of every world revision from the pre-expansion commit on, so an installed shipped copy always matches the list. Today it reads the shipped revisions as the commits after that point that touch the world folder, so a world file last changed before that commit has its shipped form covered only while the file stays unchanged. The first landing that edits the world drops that form from the list; Rampage and Sugarscape each lost one (ticket 07 finding).

- Make the generator include each world's content at the starting commit itself as a shipped revision, next to the later commits and the working tree, so a form that a build could have shipped is never dropped by a later edit.
- Regenerate the fingerprints and show the two dropped forms come back.
- A test proves the guard bites: with the starting-commit read removed, the list loses a fingerprint that a shipped build of that revision would carry.

## Acceptance criteria

- [ ] The regenerated list holds the shipped form of every world at the starting commit, at every later commit that touched it, and in the working tree; the diff shows Rampage's and Sugarscape's returned.
- [ ] A test fails when the starting-commit read is removed and passes with it.
- [ ] The generator's comment and `scripts/shipBundledWorlds.md` say which revisions carry a shipped form.
