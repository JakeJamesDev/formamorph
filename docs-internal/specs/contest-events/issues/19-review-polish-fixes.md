# 19 — Review fixes for the polish round

Status: done
Type: task

Follow-up to ticket 18: the actionable findings from its two-axis code review. Two repos — the formamorph client and FormamorphServer. Everything here is either behavior-preserving cleanup or one small, deliberate behavior change (color shorthand on the server).

## Problem Statement

The polish round shipped a third copy-pasted asset lane on the server (event posters beside avatars and thumbnails), a color validator that is stricter on the server than in the client that feeds it, and a handful of small client-side leftovers: a duplicated file-accept constant, a delegation function with one caller, a redundant union member, and two comments that break the house rules. None of these break anything today, but the server duplication means every future asset kind is a fourth copy, and the validator asymmetry means a hand-supplied shorthand color saves nothing while the client would happily render it.

## Solution

Collapse the server's per-asset-kind copies into one shared shape (a route factory for serving an image directory, and one save/delete helper parameterized by directory, allowlist, and size cap), make the server accept the same hex shorthand the client already expands, and sweep the client leftovers: one shared accept-string constant, avatar callers pointing at the generic asset-URL helper directly, the dead union member dropped, the two comments fixed.

## User Stories

1. As a server maintainer, I want one implementation of "serve an immutable image directory," so that a fix to caching, traversal stripping, or CORP headers lands everywhere at once.
2. As a server maintainer, I want one implementation of "save a base64 image upload under a UUID filename," so that the next asset kind is a three-line registration, not a fourth copy.
3. As a server maintainer, I want the avatar and poster lanes to keep their own directories, extension allowlists, size caps, and error nouns, so that deduplication does not flatten real differences between the kinds.
4. As a contest organizer, I want a shorthand hex color (`#0af`) accepted wherever a full one is, so that a color pasted from a stylesheet or typed by hand is not silently discarded by the server.
5. As a player, I want every already-working behavior — avatar serving, poster serving, upload refusals, delete-with-event — to behave exactly as before, so that this cleanup is invisible to me.
6. As a developer, I want the file-picker accept string defined once, so that adding or removing a supported image format is one edit.
7. As a developer, I want avatar URL resolution to call the generic server-asset helper directly, so that there is no single-caller pass-through function to read past.
8. As a developer, I want the poster-style function's parameter type to say only what it needs, so that the type does not imply two distinct accepted shapes when one is assignable to the other.
9. As a developer, I want comments that follow the house rules (a cast justified in one line, no comment narrating what a diff moved), so that the conventions stay enforceable by example.
10. As an agent working a future ticket, I want the review's deliberately-rejected findings recorded, so that I do not re-propose them.

## Implementation Decisions

- **Server route factory.** The avatar and event-poster serving routes become two registrations of one factory taking the directory, the extension→content-type map, and the error noun ("Avatar" / "Poster"). The factory carries the shared behavior verbatim: `path.basename` traversal strip, unknown-extension → 404, immutable one-year cache header, `Cross-Origin-Resource-Policy: cross-origin`, streamed response. Route paths and mounted URLs do not change.
- **Server storage helper.** `saveAvatar`/`saveEventPoster` and `deleteAvatar`/`deleteEventPoster` become thin wrappers over one save-image-asset / delete-image-asset pair parameterized by directory, format allowlist, and max byte size. The per-kind exported names and their signatures stay, so no controller changes are forced; the per-kind size caps (1MB avatar, 2MB poster) and allowlists are unchanged.
- **Color shorthand: the server moves.** The server's hex validator accepts 3-digit shorthand and stores the expanded 6-digit form, matching the client's parser exactly. Storing expanded means every reader — including old clients — sees the canonical form. This is the spec's only behavior change.
- **Shared accept constant (client).** The poster picker imports the avatar module's existing accept constant (the two strings are character-identical and both mean "what the picker offers and the decoder takes"), renamed or re-exported so its name no longer claims it is avatar-only.
- **Inline the avatar URL delegation (client).** The single-caller pass-through resolving an avatar path is removed; its caller uses the generic server-asset helper directly. TSDoc references in the user/feedback type files are updated to name the helper that now does the work.
- **Drop the redundant union member (client).** The poster-band function's parameter union names both the minimal style source and the full server event type; the event type is structurally assignable to the source, so the union collapses to the minimal type alone. Type-only.
- **Comment fixes (client).** The uncommented `as unknown as` cast in the event-form test gains its one-line justification; the date-time field comment that narrates what the diff moved is reworded to describe the code as it stands.

## Testing Decisions

- **Zero new seams.** Every server change is behavior-preserving except the shorthand acceptance, and all of it is pinned by the existing route/controller test files: the avatar tests and the event-poster tests must pass unmodified through the dedup — an existing test failing is the signal the refactor changed behavior. The shorthand change gets its assertions added to the existing event-poster test file (shorthand accepted and stored expanded; invalid strings still refused).
- Client changes are pinned by typecheck and the existing form/component tests; nothing new to write. A good test here is the one that already exists asserting external behavior — serving, refusing, resolving a URL — never the internal shape of the factory or helper.
- Prior art: the event-poster test file itself, which already exercises create/edit/delete/serving/legacy rows through the public API.

## Out of Scope

- The publish-window close bug (ticket 18's item 5) — still open, still owed a diagnosis; separate work.
- The thumbnails lane on the server — it predates this work and was not reviewed; folding it into the factory can be its own ticket once the factory exists.
- The three-way markdown-field duplication watch on the event form (Divergent Change note) — observation, not action.
- Any change to what the poster color picker emits, upload limits, or supported formats.

## Further Notes

Findings from the review deliberately **not** carried into this spec: the 2–4-line narrative comments (they match the house voice and the repo's own files), the event form absorbing three upgrades in one commit (inherent to a polish round), and the winner route's explicit 100kb JSON parser (a correct consequence of unmounting the group parser). The review initially recommended keeping the avatar URL delegation for call-site stability; the user chose to inline it.
