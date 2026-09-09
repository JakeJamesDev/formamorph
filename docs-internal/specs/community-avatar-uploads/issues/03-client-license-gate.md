# 03: Client license gate, shown in model details

Status: in-progress
Base: eaf2bee5
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Model rationale: a pure module with exhaustive unit tests, a type widening, and one panel addition; the rules are fully specified and the fixture builder already exists.

## Parent

[spec.md](../spec.md) — Community Avatar Uploads.

## What to build

The client can tell whether an Avatar in the Model Library has a Permissive License, and says so. The normalized VRM license gains `avatarPermission` (`onlyAuthor | explicitlyLicensedPerson | everyone`) and `modification` (`prohibited | allowModification | allowModificationRedistribution`), read from VRM 1.0 meta and left unset for 0.0. A new pure gate module takes the normalized license and returns `{ allowed, failedRequirements }`, each failure a stable identifier (the same set the server uses — see ticket 02). A stored library record whose license predates the new fields is treated as stale and re-read from the blob through the existing lazy-resolve path before the gate runs.

The model details panel shows the verdict beside the existing read-only license terms: shareable, or not shareable with each failed requirement named in player copy. Copy varies with the data; no requirement is narrated when it passes.

Requirements, all required: metadata is VRM 1.0; `avatarPermission === 'everyone'`; `allowRedistribution === true`; `modification === 'allowModificationRedistribution'`; `commercialUsage` is `personalProfit` or `corporation`. Absence fails.

## Acceptance criteria

- [ ] `readVrmMeta` returns the two new fields for VRM 1.0 fixtures and leaves them unset for VRM 0.0 (extend the in-test GLB fixture builder; no binary fixtures).
- [ ] Gate unit tests: all pass; each requirement failing alone reported by name; VRM 0.0 rejected; null metadata rejected; missing fields rejected.
- [ ] A stored record with an old-shape license is re-read from the blob and then kept.
- [ ] Model details shows "shareable" for both bundled avatars and names the failures for a VRM 0.0 file and a plain glTF.
- [ ] No IndexedDB migration; the widened license is a local record field only. No export-shape change.
- [ ] Four gates green; changelog In-Progress entry added.
