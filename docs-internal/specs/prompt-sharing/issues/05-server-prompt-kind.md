# 05: Server `prompt` Kind

Status: in-progress
Base: 657e4e7 (FormamorphServer)
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: `docs-internal/specs/prompt-sharing/spec.md`

**Repo: FormamorphServer.** This ticket is filed here so the effort reads as one list. The work and its
commit happen in the server repo.

## What to build

The server accepts, stores, lists, and filters listings of kind `prompt`.

- Add `prompt` to the server's kind config, with a 1 MB content limit.
- The listing row gains `models`: an array of strings. Create and update accept it. List and detail
  responses return it. For other kinds, pick one behavior (empty array or omitted) and keep the response
  stable for old clients.
- Validate `models` as strings only. Trim and de-duplicate. No maximum count or length beyond the row's
  existing limits. A `prompt` create or update with no valid model is refused with a clear message.
- The description is optional for this kind.
- The list endpoint accepts a model substring filter, case-insensitive, that applies with `kind=prompt`.
- A `prompt` listing needs no thumbnail. Confirm create and update accept a missing thumbnail for this kind.
- Changelog, likes, reports, and quarantine work for the kind with no new code paths. Contest entry is
  refused for this kind.
- A `prompt` can declare compatible worlds, and shows on a world wherever compatible offers already show.
  It is not a component kind: a world cannot require it, and unlisted visibility is refused.
- Follow the repo's migration practice for the new column. Read the SQLite gotchas recorded for Content
  Reports first.

The client contract: create and update send `kind`, `name`, `description`, `tags`, `models`,
`contentData`, and the optional `visibility` and `compatibleWorlds`. `contentData` is the shared preset
artifact, stored as opaque JSON.

## Acceptance criteria

- [ ] Route tests: create, update, list, and detail for `kind=prompt`, with `models` round-tripping
- [ ] Route test: the model filter matches by case-insensitive substring and ignores other kinds
- [ ] Route test: non-string `models` members are rejected or dropped, per the repo's validation style
- [ ] Route test: contest entry with a `prompt` listing is refused
- [ ] Route test: a `prompt` with no valid model is refused; a blank description is accepted
- [ ] Route test: a `prompt` accepts compatible worlds, refuses unlisted, and cannot be a world's requirement
- [ ] `kind=all` still returns the existing kinds unchanged, plus `prompt`
- [ ] An old client that sends no `models` still creates and updates other kinds
- [ ] The migration runs on a copy of the dev database
- [ ] The server repo's gates are green; the deploy is left to the user
