# 06: Prompts Browse Section

Status: ready-for-human
Status note: done in formamorph (this commit) and FormamorphServer 21de6bf, server not deployed
Base: c7feaa98
Blocked by: 05
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: `docs-internal/specs/prompt-sharing/spec.md`

## What to build

The community browser gets a Prompts section. A player opens a prompt listing and reads what it is.
Download comes in ticket 09.

- Add the `prompt` catalog kind on the client: labels Prompt / Prompts, a fixed kind icon, a 1 MB publish
  limit, a browse section, and the card-type mapping. The kind drift guards cover it.
- The local library has no Prompts tab. Presets live in Settings. Map the kind so the library code does not
  expect one.
- The section uses the same card grid, status facets, sort, and per-section filter state as the other
  kinds. Cards show the kind icon in place of a thumbnail.
- The section is visible in Simple mode.
- Listing details show description, tags, models, author, the changelog, and "Made for Formamorph X" from
  the listing row's `app_version`. The details read returns no content, and the content read counts a
  download, so the panel never parses the artifact.
- Server part (FormamorphServer, its own commit): the row gains `app_version`, derived from the artifact's
  stamp at create and update of a `prompt`, null when the stamp is missing or not a short string, null for
  other kinds. List and detail responses return it. The client shows the line only for a non-empty string.
- Likes, reports, quarantine, and hidden tags and authors work as for other kinds.
- A server that does not know the kind returns nothing; the section then shows its empty state.
- Add the dev-router coverage needed to land on the section in one call.

Until ticket 07 ships, seed a listing through the dev server to check the section.

## Acceptance criteria

- [x] Kind drift-guard tests are green with `prompt` added
- [x] The section appears in the rail and in the portrait selector, in Simple and Advanced mode
- [x] A prompt card renders with the icon and no broken image request
- [x] Details show models, tags, author, description, and the made-for version
- [x] Filter state for the section persists separately from the other sections
- [x] Report and like work on a prompt listing against the dev server
- [x] Checked in the preview at desktop and mobile width, both themes
- [x] Changelog In-Progress entry added; four gates green

## Comments

**2026-09-19, ticket session:** Done. The server part is FormamorphServer `21de6bf`, not deployed.

- The spec session ruled that `app_version` lives on the row. The server derives it at create and update of a prompt, and backfills existing prompt rows once. It keeps only a version-shaped string of 32 characters or fewer, so `v2.0.3` reads as null.
- An update without content keeps the stored version.
- Prompt cards and details never request the stand-in thumbnail that the server gives every row.
- The website route accepts `/community/prompt/<id>` too, because the site uses the same browser. It still refuses `model`. That gap predates this ticket.
- Simple mode: the browser has no Simple or Advanced gating. The live check ran in the default mode only.
- Live check: a prompt seeded on the local dev server, then a like and a report on it. Both succeeded. Screenshots at desktop dark and mobile light.
- Status facets work for prompts, but nothing can mark a prompt as downloaded until ticket 09.
