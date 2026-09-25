# 01: Generate the bundled fingerprint list

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the fingerprint must match byte for byte across two repos and every past revision. Precision matters more than speed.

## What to build

A developer runs one command, and the client repo writes the fingerprint list. The list holds the fingerprint of every git revision of every bundled world, plus the byte SHA-256 of the SFW default Avatar and the release default Avatar. A test fails whenever a bundled world's current text has no fingerprint in the list. The release skill gains the step that regenerates the list and copies it into the server repo.

The fingerprint function is defined in the spec's Implementation Decisions. A throwaway validation run found zero raw-vs-published mismatches across 53 revisions once `code` values were skipped. Three pre-rename revisions did not load in that run. This generator must follow renames so that they load.

## Acceptance criteria

- [ ] The fingerprint function lives in one client module, and nothing else computes it.
- [ ] A shared test vector (a small fixture world and its expected hex fingerprint) pins the function. The same vector is written for ticket 04 to copy.
- [ ] The generator walks the full history of every bundled world file, follows renames, and reads every revision without error.
- [ ] Every revision's raw fingerprint equals the fingerprint of its migrated publish payload. The generator fails loudly on a mismatch.
- [ ] The list includes the byte hashes of both default Avatar files.
- [ ] The list is committed and runs as a package script.
- [ ] The drift test fails after a long text value in a bundled world changes, and passes after the generator runs. Proven by making the edit.
- [ ] The release skill has a step to regenerate the list and copy it into the server repo.
- [ ] Four gates green.
