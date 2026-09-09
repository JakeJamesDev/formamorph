# 04: Server: listing relationships and Unlisted

Status: ready-for-human
Base: 2fd6196
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

## Comments

**Implemented in the server repository at commit `91541c1` (Base `2fd6196`).** Gate: `npm test`, 47 files,
1478 passed, 2 skipped, 14.8 s wall. Every acceptance criterion passes; the tests are in
`tests/linkedContent.test.js`.

**Decisions confirmed by the author on 2026-09-09** (the first four below were put to them directly; the rest follow the parent spec):

- A world author can only require a source they could open themselves. A stranger holding an unlisted id
  gets `SOURCE_NOT_FOUND`. Without this, anyone who received an unlisted id through a dependency download
  could publish a world that requires it and hand it to the room. The spec's "no separate permission step"
  still holds for public sources. Trade-off: a collaborator handed an unlisted id out of band cannot
  require it until the owner lists it or adds them as staff.
- Staff may replace a world's dependency set and a component's compatibility set, under the same
  `canModerate` rule every listing edit uses. The ticket says the authors write these; moderation parity
  keeps a malicious declaration removable. Review state stays author-only, as the ticket says.
- Declined associations are hidden from everyone but the component's author and staff, per the parent
  spec's settled decision. The ticket's "readable by everyone the listing is visible to" is the stale line.
- A component is `entity` or `dictionary`, per the Terms table. A `model` (Avatar) cannot be unlisted,
  required, or offered. Widening that is a config change (`COMPONENT_KINDS`).
- Unlisted listings do not count toward an author's public profile totals, matching the quarantine rule.
- Reporting an unlisted listing stays allowed: a player who received it inside a dependency download must
  be able to report it, and the report answer reveals nothing but that the id exists, as quarantine already
  does.
- A content-only `PUT /api/worlds/:id` now bumps `updated_at` and `revision`. Before this change it moved
  neither, so a re-exported dictionary never reached the follow feed as an update.

**Contract summary** is in the server `README.md` under "Linked content", and the glossary in `CONTEXT.md`.
