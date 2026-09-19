# 09: Download, Update, and Use This Preset

Status: ready-for-agent
Blocked by: 02, 07
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: `docs-internal/specs/prompt-sharing/spec.md`

## What to build

A player downloads a prompt listing into their preset list, activates it, and gets updates in place.

- Download parses the listing content with the share sanitizer. Missing prompt keys inherit the current
  defaults. Tuning is always applied; there is no tuning choice at download.
- One local copy per listing. The first download adds a user preset with the community link set and dirty
  false. A later download replaces that preset under the same id, so world and folder pins stay valid. Never
  mint a new id on re-download.
- A dirty copy gets the existing "your changes are lost" confirm before it is replaced.
- A blank Author is filled with the uploader's username.
- An app version mismatch shows the existing mismatch warning text.
- Download does not change the active preset. A **Use This Preset** action on a downloaded listing selects
  it as the global preset. It works in Simple mode. It shows the active state when that preset is already
  selected.
- Download state for the kind uses the shared rule: none, refresh, or update, from the server updated stamp
  against the stored source stamp. Local edits do not affect it. The Downloaded and Update status facets
  work in the Prompts section.
- A preset from a file or a share code stays unlinked.

## Acceptance criteria

- [ ] Download state tests for the `prompt` kind: none, refresh, update
- [ ] Context tests: replace in place keeps the id; a world pinned to the preset resolves to it after an update
- [ ] Test: a dirty copy asks before it is replaced; a clean copy does not
- [ ] Test: blank Author is filled; a set Author is kept
- [ ] Test: a listing with missing prompt keys downloads and runs on defaults for those keys
- [ ] Use This Preset selects the preset in Simple mode and in Advanced mode
- [ ] The link never appears in an export of the downloaded preset
- [ ] Full flow checked against the dev server: publish, download on a second profile, edit, update
- [ ] Changelog In-Progress entry added; four gates green
