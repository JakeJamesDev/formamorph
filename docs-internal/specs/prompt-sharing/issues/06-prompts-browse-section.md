# 06: Prompts Browse Section

Status: in-progress
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

- [ ] Kind drift-guard tests are green with `prompt` added
- [ ] The section appears in the rail and in the portrait selector, in Simple and Advanced mode
- [ ] A prompt card renders with the icon and no broken image request
- [ ] Details show models, tags, author, description, and the made-for version
- [ ] Filter state for the section persists separately from the other sections
- [ ] Report and like work on a prompt listing against the dev server
- [ ] Checked in the preview at desktop and mobile width, both themes
- [ ] Changelog In-Progress entry added; four gates green
