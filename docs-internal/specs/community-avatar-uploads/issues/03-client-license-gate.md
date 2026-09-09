# 03: Client license gate, shown in model details

Status: ready-for-human
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

- [x] `readVrmMeta` returns the two new fields for VRM 1.0 fixtures and leaves them unset for VRM 0.0 (extend the in-test GLB fixture builder; no binary fixtures).
- [x] Gate unit tests: all pass; each requirement failing alone reported by name; VRM 0.0 rejected; null metadata rejected; missing fields rejected.
- [x] A stored record with an old-shape license is re-read from the blob and then kept.
- [x] Model details shows "shareable" for both bundled avatars and names the failures for a VRM 0.0 file and a plain glTF.
- [x] No IndexedDB migration; the widened license is a local record field only. No export-shape change.
- [x] Four gates green; changelog In-Progress entry added.

## Comments

Implemented `gateAvatarLicense` in [avatarLicenseGate.ts](../../../../src/lib/avatarLicenseGate.ts) with identifiers `metaVersion` / `avatarPermission` / `allowRedistribution` / `modification` / `commercialUsage` — no literal strings were pinned anywhere shared with ticket 02 (server, different repo) at implementation time, so these are a first proposal, not a confirmed contract. Ticket 04 (blocked on this one and on 02) should reconcile them against whatever ticket 02 actually shipped before wiring the publish flow.

Two-axis review against `Base` found one real Spec-axis gap, folded in: the library grid's thumbnail backfill only runs for a model with no thumbnail, so a legacy model that already has one was never re-read and stayed on a stale-shape license — a false "Not shareable" verdict — for the whole session. [ModelDetailsModal.tsx](../../../../src/components/modals/ModelDetailsModal.tsx) now forces the same backfill on open, regardless of thumbnail state, and reads the record back afterward rather than trusting the grid's in-memory metadata.

Named but not fixed (Standards-axis, judgment call): [ModelDetailsPanel.tsx](../../../../src/components/modals/ModelDetailsPanel.tsx) now states "no VRM data" two ways for a plain glTF — the gate's own "Needs VRM 1.0 metadata…" line, and the pre-existing "A plain glTF carries no license information…" paragraph a few lines below it. Both are true and neither is wrong, but they're two independent code paths for the same fact; worth collapsing if this panel is touched again.

Also out of scope, noted for awareness: the model library grid's own in-memory list (`MainMenu.tsx`) still only patches `thumbnail`, not `license`, when its backfill loop resolves one — so a grid-level shareability badge, if one is ever added there, would need the same fix this ticket applied to the details modal.
