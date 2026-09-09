# 05: Save an Avatar to the Model Library

Status: ready-for-human
Base: 4d04e0a5
Blocked by: 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Model rationale: a fourth instance of an existing, well-tested download hook plus storage-record fields and a device-download variant; follows the entity and dictionary precedent closely.

## Parent

[spec.md](../spec.md) — Community Avatar Uploads.

## What to build

A viewer saves an Avatar listing into the Model Library. A fourth library-download instance stores one copy per listing, keyed by the community link, so a second save refreshes the copy rather than adding one. The model library record gains the same community-link fields the entity and dictionary libraries store, which drive the card's Downloaded and Update Available states. There is no dirty-copy confirmation (models are not edited locally) and no one-click apply; choosing the Avatar for a world stays in the existing model picker.

Device download of an Avatar listing saves the `.vrm` file itself, not a JSON wrapper. This is what the website's read-only catalog offers where its capabilities allow; verify the site's embedded browser lists Avatars and downloads the file.

## Acceptance criteria

- [ ] Save to Model Library stores the VRM bytes, name, thumbnail, license, hash, and community-link fields; the model appears in the library and in the model picker.
- [ ] Card and details show none / Downloaded / Update Available correctly across save, re-publish, and re-save (hook tests in the existing style; one copy per listing).
- [ ] A second save refreshes the existing copy; no duplicate record.
- [ ] Device download hands the user a `.vrm` file with the listing's name.
- [ ] Website catalog: Avatars section present, cards render, device download works where enabled, library save absent.
- [ ] Model library record shape change is local only; no export-shape change.
- [ ] Four gates green; changelog In-Progress entry added.

## Comments

Implemented in `0a434d33`. Standards and Spec review (`/mattpocock-skills:code-review 4d04e0a5`) ran clean: no hard standards violations, no missing requirements, no scope creep. One spec-review soft note — the acceptance criteria list "thumbnail" among what Save stores, but the implementation stores none at download time and leans on `ModelStorageService.ensureThumbnail`'s existing lazy-backfill path (the same one legacy and freshly-migrated records already use) instead; the outcome (the model appears with a picture) is unaffected. Made that intent explicit with a comment at the `modelDownload.store` call site rather than changing the behavior.
