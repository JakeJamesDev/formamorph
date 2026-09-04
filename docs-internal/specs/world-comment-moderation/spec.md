# World Comment Editing, Deletion & Markdown

Status: ready-for-agent

## Problem Statement

Comments on community worlds are write-once plain text. A commenter cannot fix a typo or remove something they regret; staff have no way to remove abusive or rule-breaking comments from the client (the server capability exists but is unreachable); and comment bodies render as raw text, so any formatting a user attempts shows up as literal markdown characters. Meanwhile the feedback system already has all of this — edit, delete, markdown, an edit toolbar — so the two comment surfaces feel inconsistent.

## Solution

Bring world comments up to full parity with feedback comments. Authors can edit their own comments indefinitely (with a visible "edited" marker) and delete them. Staff can delete comments under the standard moderation hierarchy, and a world's author can delete any comment on their own world. Comment bodies render as markdown through the app's standard renderer, and both the compose box and the inline edit box use the standard markdown-toolbar editor with a preview tab. The server routes for edit and delete already exist; they get wired up, tightened to match the permission spec, and extended with an edited-at timestamp.

## User Stories

1. As a commenter, I want to edit my own comment after posting, so that I can fix typos and clarify what I meant.
2. As a commenter, I want no time limit on editing my own comments, so that I can improve them whenever I notice a problem.
3. As a commenter, I want to delete my own comment, so that I can remove something I no longer stand behind.
4. As a commenter, I want a confirmation prompt before my comment is deleted, so that I don't lose it to a stray click.
5. As a reader, I want edited comments to carry a visible "edited" marker, so that I know the text may have changed since replies were written.
6. As a reader, I want comments to render markdown (emphasis, lists, code, links, and the rest of the renderer's feature set), so that formatted comments are readable rather than full of literal syntax characters.
7. As a reader, I want old comments written before this feature to render through the same pipeline, so that the comment section looks uniform.
8. As a commenter, I want a markdown toolbar on the compose box, so that I can format a new comment without knowing markdown syntax.
9. As a commenter, I want the same toolbar on the edit box, so that editing works the way composing does.
10. As a commenter, I want a preview tab while composing or editing, so that I can see how my markdown will render before submitting.
11. As a commenter, I want up to 4000 characters (matching feedback comments), so that formatted comments with code blocks and lists have room to breathe.
12. As a commenter, I want the edit and delete controls to appear only on my own comments, so that the UI tells me what I'm allowed to do.
13. As a world author, I want to delete any comment on my own world, so that I can moderate my own page.
14. As a staff member (mod/dev/admin), I want to delete comments by users I'm allowed to moderate, so that I can remove rule-breaking content.
15. As a staff member, I want my comment deletions recorded in the audit log with a snippet of the removed content, so that moderation actions stay reviewable.
16. As a staff member, I want to be unable to edit other users' comments, so that moderation never extends to rewriting someone's words.
17. As a mod, I want the moderation hierarchy respected (staff moderate normal accounts, admins also reach mod/dev, nobody touches an admin), so that comment moderation matches every other community moderation surface.
18. As a commenter on a quarantined world, I want to still be able to edit or delete my existing comments, so that quarantine doesn't trap my words on a world under moderation.
19. As a commenter, I want the comment count on the world listing to stay accurate after deletions, so that the browser reflects reality.
20. As a user whose edit or delete fails (network, permission, server error), I want a clear error toast and my comment left intact, so that failures are visible and non-destructive.
21. As a logged-out visitor, I want to keep reading comments (rendered as markdown) without seeing edit or delete controls, so that the read experience is unchanged.

## Implementation Decisions

**Permissions (the settled matrix)**

- Edit: comment author only, forever. The server's comment-update route currently allows staff via the moderation check — that is removed, matching the feedback rule that moderation does not extend to rewriting someone's words.
- Delete: comment author, the world's author (their own page), or staff per `canModerate(actor, commentAuthor)`. All three already exist server-side; the client surfaces all three.
- Quarantine: unchanged — posting stays blocked on quarantined worlds; edit and delete stay allowed.
- Audit: deletes keep writing the existing `comment_deleted` audit entry (actor, target user unless self-delete, world name, content snippet). Edits are not audited; no `comment_edited` action is added.

**Server (FormamorphServer — Express/better-sqlite3)**

- The flat comment routes (`PUT /api/comments/:id`, `DELETE /api/comments/:id`) are the contract. No nested world-scoped edit/delete routes are added; the client must call the flat paths.
- New nullable `edited_at` column on the comments table, added via the established boot-time idempotent column-migration pattern (check `sqlite_master` + `PRAGMA table_info`, `ALTER TABLE ADD COLUMN`, wired into server startup before index creation). Never backfilled; `updated_at` is not a substitute since it is non-null from insert.
- The comment model stamps `edited_at` (ISO-8601) on every update; the column rides the existing raw-row serialization, so responses gain a snake_case `edited_at` field alongside `content`/`created_at`. No DTO/camelCase rework of the world-comment shape in this feature.
- Character cap raised from 1000 to 4000 on both create and update validators, matching the feedback comment cap.

**Client (formamorph)**

- The world storage service gains update and delete comment methods mirroring the feedback service's shapes, targeting the flat routes, auth header required.
- The remote world details modal's comment section adopts the feedback thread view pattern wholesale: pencil (own comments only) and trash (own, own-world, or moderable) icon buttons, inline edit swap-in, confirm dialog before delete, italic "· edited" marker beside the timestamp when `edited_at` is set.
- Both the compose box and the inline edit box become the markdown prompt-field editor (plain vocabulary, markdown toolbar, preview tab, 4000-char cap), replacing the bare textarea.
- Comment bodies render through the standard markdown renderer (Streamdown pipeline with the app's remark plugins and its built-in sanitization). All comments render this way, including pre-feature ones — one render path, no format/version flag.
- The gating inputs (`currentUser`, own-listing flag) are already available in the modal; visibility uses the shared role helpers (`isStaff`, `canModerate`).
- Delete updates the local list and comment total; edit updates the comment in place with the server-confirmed body and `edited_at`.

## Testing Decisions

Tests assert external behavior at existing seams; no implementation-detail testing (no spying on internals, no asserting intermediate state).

**Server — HTTP route level via supertest (the repo's standard seam):**

- A comment-editing suite covering the full permission matrix: author can edit; staff cannot edit another user's comment (the tightened rule — this test must fail against today's controller); author, world author, and eligible staff can delete; staff cannot delete an admin's comment; delete writes the audit entry with correct target and snippet; edit stamps and serializes `edited_at`; unedited comments serialize `edited_at` as null; 4000-char bodies accepted, 4001 rejected, on both create and update; edit/delete still work on a quarantined world while create stays blocked; comment count on the world stays consistent after delete. Prior art: the feedback-editing, worlds, and audit suites.
- Boot-schema coverage asserting the `edited_at` column exists after startup migrations, per the existing boot-schema suite.

**Client:**

- World storage service tests with stubbed global fetch for the two new methods (URL, verb, auth header, payload, error propagation) — the service's existing test pattern.
- A new component test for the remote world details modal's comment section, modeled on the feedback thread view test: control visibility per viewer (comment author, world author, staff over normal user, staff vs admin author, stranger, logged out), the edit flow updating the body and showing the edited marker, the delete flow with confirmation, and markdown rendering of a comment body.

## Out of Scope

- Comment threading/replies (comments stay flat), reporting/flagging, and a dedicated comment rate limiter.
- Any camelCase/DTO normalization of the world-comment response shape.
- Auditing comment edits.
- Changing quarantine semantics for comments.
- The committed `.env` in the server repo containing a real JWT secret and admin password — flagged during exploration; needs its own session.
- Server deployment (manual, to the production workshop host) — migrations self-run at boot, so deploy order doesn't matter, but the actual deploy is coordinated by the user.

## Further Notes

- The server currently grants staff edit power over world comments; nothing in the shipped client exercises it, so tightening it is not a user-visible regression.
- `updated_at` on comments is stamped at insert and cannot distinguish "edited" from "never edited" — that's why `edited_at` is a new column rather than a derived comparison.
- The feedback system is the reference implementation for both the UX and the server authorization shape; where the two comment systems differ (field naming, route nesting), world comments keep their existing conventions rather than converging in this feature.
