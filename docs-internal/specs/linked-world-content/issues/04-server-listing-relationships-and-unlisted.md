# 04: Server: listing relationships and Unlisted

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: server work in the separate server repository with access-control rules, moderation parity, and deletion semantics; mistakes here leak unlisted content or strand dependents.

## Parent

[spec.md](../spec.md) — Relationship authority and download behavior, Publishing and updating, Settled follow-up decisions (Unlisted, Relationships over time), open questions 3 and 4.

## What to build

Workspace: the Formamorph server repository. The catalog learns three things about a listing: what it requires, what it is compatible with, and whether it is listed.

A world listing declares required dependencies by source listing id. A component listing declares compatibility with world listings, and each association carries the world author's review state: unreviewed, approved, or declined. Only the world author writes the review state; the component author writes the association. A component listing carries a visibility of public or unlisted.

Access rules for unlisted listings: the author and staff read and moderate it exactly like a public listing. Anyone else gets not found on a direct read, on search, and on browse. The one other path is dependency resolution: a request that resolves a world's required dependencies returns the unlisted listing and its content to any client that may read the world. An unlisted listing is never returned as an add-on offering.

Changes carry a revision marker per listing so clients can detect a source change without the server keeping versions. Deleting a listing is hard: dependents receive not found. A departed author who chose Keep My Work keeps unlisted listings too, still unlisted. A republished listing has a new id; the server does not link it to the old one.

Every change is additive to existing routes and payloads. Existing clients keep working.

## Acceptance criteria

- [ ] A world listing can declare required dependencies; a component listing can declare compatibility; both are returned on read.
- [ ] Review state is writable only by the world author and readable by everyone the listing is visible to.
- [ ] An unlisted listing: author reads it, staff read and moderate it, another user gets not found on read, search, and browse.
- [ ] Dependency resolution for a world returns its unlisted required component to a user who cannot read it directly.
- [ ] Add-on offerings for a world never include an unlisted component.
- [ ] Hard delete of a required source makes dependency resolution report it not found; Keep My Work deletion keeps an unlisted listing under the placeholder account.
- [ ] Existing client routes and payloads are unchanged in shape apart from added fields; the server test suite passes.

## Blocked by

- None — can start immediately.
