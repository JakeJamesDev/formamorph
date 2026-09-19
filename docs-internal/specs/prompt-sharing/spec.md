# Prompt Sharing — Spec

Status: ready-for-agent
Spec session: Prompt upload and sharing

A user prompt preset gets an **Overview**: author, description, tags, and the models it works with. The
Overview travels with every export. Authors publish presets to the community catalog as a new `prompt`
kind, and players browse, download, and activate them.

## Problem Statement

A prompt preset decides how well a model narrates. Authors tune presets for one model and share them as a
`.json` file or a share code. The person who receives it sees only a name. They do not know what the preset
is for, who wrote it, or which model it fits.

There is no place in the app to find presets. Authors pass share codes around by hand. A player on a small
model has no way to find a preset that was written for that model.

## Solution

- Each user preset has an **Overview** screen with four fields: Author, Description, Tags, Models.
- The Overview travels in the `.json` file and in the share code. The import dialog shows it before the
  user accepts.
- An author publishes a preset to the community catalog from the Prompts screen.
- The community browser gets a **Prompts** section. Players filter it by tag, author, and model.
- A player downloads a preset and activates it with one action, in Simple mode too.
- A downloaded preset keeps a link to its listing. The browser shows when the listing has an update.

## User Stories

### Overview

1. As a preset author, I want an Overview screen for my preset, so that I can describe it in one place.
2. As a preset author, I want a markdown description, so that I can explain what the preset changes and how to use it.
3. As a preset author, I want to add free-form tags, so that I can label the preset by style and purpose.
4. As a preset author, I want tag input that does not suggest world tags, so that the suggestions fit prompts.
5. As a preset author, I want to list the models the preset works with, so that players know if it fits their model.
6. As a preset author, I want model suggestions from the endpoints I use, so that I can add a model without typing its id.
7. As a preset author, I want suggested model names without the quant and file extension, so that the name matches what other authors write.
8. As a preset author, I want tag and model suggestions from other prompt listings, so that my spelling matches the catalog.
9. As a preset author, I want an Author field, so that my name travels with the preset.
10. As a preset author, I want no length limits on these fields, so that the Overview behaves like a world's.
11. As a player, I want built-in presets to have no Overview entry, so that I do not see fields I cannot edit.
12. As a preset author, I want Overview as the first entry in the prompt rail, so that I find it before the individual prompts.
13. As a mobile user, I want Overview as the first entry in the prompt selector, so that I reach it on a small screen.
14. As a preset author, I want a duplicated preset to keep its Overview, so that I do not type it again.

### File and share code

15. As a preset author, I want the Overview inside the `.json` export, so that the file explains itself.
16. As a preset author, I want the Overview inside the share code, so that a pasted code explains itself.
17. As a player, I want the import dialog to show author, description, tags, and models, so that I can decide before I import.
18. As a player, I want a preset from an older app to import without an Overview, so that old files and codes still work.
19. As a player, I want malformed Overview data dropped on import, so that a crafted code cannot corrupt my presets.
20. As a preset author, I want my endpoint routing to stay out of every export, so that my machine's setup stays private.
21. As a player, I want the link to a community listing to stay out of every export, so that exports hold authored content only.

### Header actions

22. As a preset author on desktop, I want a Publish button beside Export, so that upload is one click away.
23. As a mobile user, I want the header to show the preset selector and one overflow menu, so that the row is not crowded.
24. As a mobile user, I want Rename, Export, Publish, Reset, and Delete in that menu with the destructive items last, so that I do not tap them by mistake.
25. As a player on a built-in preset, I want actions that do not apply to be absent from the menu, so that the menu matches the desktop row.

### Publish

26. As a preset author, I want to publish a preset as a new listing, so that other players can find it.
27. As a preset author, I want to overwrite one of my own listings, so that I can ship an update.
28. As a preset author, I want publish blocked until Models has one entry, so that every listing says what it works with.
29. As a preset author, I want the listing description and tags taken from the Overview, so that I enter them once.
30. As a preset author, I want to write a changelog entry when I update, so that players see what changed.
31. As a preset author, I want to mark compatible worlds, so that players of those worlds find the preset.
32. As a preset author, I want tuning (samplers, reasoning, max output, verbatim) always included, so that the listing is the full preset.
33. As a preset author, I want my local preset linked to the listing after publish, so that the app knows they are the same.
34. As a preset author, I want the same policy and terms gate as other kinds, so that the rules are consistent.
35. As a preset author, I want a size check before upload, so that I get a clear error instead of a server rejection.

### Browse

36. As a player, I want a Prompts section in the community browser, so that I can find presets.
37. As a player, I want prompt cards with a fixed icon, so that they look deliberate without a thumbnail.
38. As a player, I want a Models filter beside Tags and Authors, so that I can find presets for my model.
39. As a player, I want the Models filter to match by substring, so that "cydonia" finds every spelling.
40. As a player, I want a `model:` search prefix, so that I can filter from the search box.
41. As a player, I want the listing details to show description, tags, models, and author, so that I can judge the preset.
42. As a player, I want the details to show which app version the preset was made for, so that I can spot an old one.
43. As a player, I want the same status filters as other kinds (downloaded, update available), so that the browser is consistent.
44. As a player, I want my filters for the Prompts section remembered separately, so that they do not change my world filters.
45. As a Simple-mode player, I want to see the Prompts section, so that I can use community presets without Advanced mode.
46. As a player, I want to report a prompt listing, so that bad content gets handled like any other kind.
47. As a player, I want to like a prompt listing and see its changelog, so that prompts have the same social features.

### Download and update

48. As a player, I want to download a preset into my preset list, so that I can select it.
49. As a player, I want a **Use This Preset** action after download, so that I can activate it without opening Settings.
50. As a player, I want one local copy per listing, so that a second download updates it in place.
51. As a player, I want a confirm before an update replaces a copy I edited, so that I do not lose my changes.
52. As a player, I want worlds and folders pinned to the preset to stay pinned after an update, so that my setup does not break.
53. As a player, I want a warning when the preset was made for a different app version, so that I expect drift.
54. As a player, I want prompt text that the listing does not have filled from the current defaults, so that an old preset still runs.
55. As a player, I want a blank Author filled with the uploader's name at download, so that the credit is not empty.
56. As a player, I want to edit a downloaded preset and keep its link, so that I still see updates.
57. As a player, I want the browser to mark the listing as having an update when the server copy is newer, so that I know to download again.
58. As a player, I want a file or share code import to create an unlinked preset, so that it behaves like an imported world.

## Implementation Decisions

### Data shape

- A user preset gains an optional `overview` block: `author`, `description`, `tags`, `models`. All strings
  or string arrays. Built-in presets carry none, and the setter does nothing on them, like the other
  preset-scoped tuning.
- The description is markdown. No field has a length or count cap. Tags and models are stored trimmed and
  de-duplicated; tags are lowercased, models keep the author's casing.
- The shared preset artifact gains the same optional `overview` block. It is additive, so the format
  version does not change. Older clients drop it on import.
- **This changes a released share format.** The version and any migration are the user's call.
- Import validates types only: strings stay, everything else drops. No truncation.
- A stored user preset gains the local-only community link used by library items: source id, source
  updated stamp, source author id and name, downloaded stamp, dirty flag, edited stamp. It is never
  exported or published.
- The share builder keeps its explicit field list. Endpoint routing and the community link are excluded by
  construction, each with its own guard test.
- The preset store stays in local storage. No world or save export shape changes. World and folder preset
  pins key on the preset id and stay local.

### Overview screen

- A preset-level rail entry named Overview sits above the prompt groups and first in the mobile selector.
  It does not render for built-in presets. The Prompts screen stays Advanced-only.
- Field order: Author, Description, Tags, Models. The description uses the markdown prompt field. Tags and
  Models use the existing free-form chip input.
- Tag suggestions come only from tags on prompt listings in the loaded catalog. The world tag vocabulary is
  not used. With no catalog loaded, the field has no suggestions.
- Model suggestions come from two sources: the model ids reported by the active endpoint and by every
  endpoint a prompt is routed to, and the models named on prompt listings in the loaded catalog.
- A new pure function turns a `/models` response body into a list of ids. It accepts the LM Studio and the
  OpenAI shapes, removes the file extension and the quant suffix, and de-duplicates. The existing
  reachability probe keeps its three-value verdict; the id list is fetched on demand when the Models field
  opens and cached per endpoint for the session.
- An edit to the Overview of a linked preset sets its dirty flag, like a prompt text edit.
- The screen gets a dev-router entry.

### Header actions

- Desktop keeps the full row and gains Publish beside Export. Publish does not render for built-ins.
- Below the `md` breakpoint the row shows the preset selector and one overflow menu. Menu order: Rename,
  Export, Publish, then a separator, then Reset, Delete. An action that does not render on desktop for the
  current preset is absent from the menu. The confirm dialogs for Reset and Delete stay.

### Import dialog

- The preview shows author, description (rendered markdown), tags, and models when the payload has an
  Overview. The existing name, warnings, tuning, and collision controls stay.

### Catalog kind

- A new catalog kind `prompt`, added in both repos. Labels: Prompt / Prompts. It gets a fixed kind icon, a
  browse section, a publish size limit of 1 MB, and no thumbnail.
- The listing content is the shared preset artifact, unchanged, so one parser serves file, code, and
  download.
- The server stores `models` as a string array on the listing row and returns it in list and detail
  responses. The list endpoint accepts a model substring filter.
- The server stores `app_version` on the row, derived from the artifact's stamp at create and update, and
  returns it in list and detail responses. The details read returns no content and the content read counts
  a download, so "Made for Formamorph X" and the pre-download mismatch check read the row, never the artifact.
- The server also refuses a `prompt` with no valid model. The description is optional for the kind.
- `prompt` is compatible-only, not a component kind. It can declare compatible worlds and shows on a world
  where compatible offers already show. A world cannot require it, and unlisted visibility is refused,
  because unlisted exists for required components.

### Publish

- The kind-agnostic publish dialog handles the `prompt` kind. It shows the changelog and compatible worlds
  sections. It does not show contest entry, linked content, or the remote-image warning.
- A new payload builder maps the preset to the publish payload: listing name from the preset name,
  description and tags from the Overview, models as a new payload field, content from the shared preset
  artifact with tuning always present.
- Publish is blocked while Models is empty. The block names the Overview field.
- New versus overwrite is the author's choice each time, from their own listings of this kind. After a
  successful publish the local preset links to the listing.

### Browse

- The Prompts section uses the same card grid, status facets, sort, and per-section filter state as the
  other kinds. It is visible in Simple mode.
- The filter bar gains a Models chip filter for this section only, with suggestions from the catalog in
  view. It matches by case-insensitive substring. The search box accepts a `model:` prefix.
- Listing details show description, tags, models, author, the changelog, and "Made for Formamorph X" from
  the artifact's app version stamp.
- Likes, reports, quarantine, and hidden tags and authors work as for every other kind.

### Download and update

- One local copy per listing. The first download adds a user preset with the link set. A later download
  replaces that preset in place under the same id.
- A dirty copy gets the existing "your changes are lost" confirm before it is replaced.
- Download reuses the import sanitizer. Missing prompt keys inherit the current defaults. An app version
  mismatch shows the existing warning text.
- A blank Author is filled with the uploader's username at download.
- Download does not activate the preset. A **Use This Preset** action on the downloaded listing selects it
  as the global preset. It works in Simple mode.
- Update detection compares the server updated stamp with the stored source stamp. Local edits do not
  affect it.
- A preset from a file or share code, and a duplicated preset, have no link. Deleting a preset drops its
  link.
- Reverse display on a world listing matches what other kinds get today. No new surface.

### Build order

The tickets under `issues/` own the order. Browse lands before publish so a published listing has a place
to show. Tickets 01, 04, and 05 have no blockers. Ticket 05 is FormamorphServer work.

## Testing Decisions

A good test here calls a public seam with realistic input and checks the result a user or another module
sees. It does not check internal calls or mirror the implementation. Each guard test is proven by putting
the bug back once.

| Seam | Proves | Prior art |
|---|---|---|
| Share module: build, then parse | Overview survives a round trip through file and code. Wrong types drop. The community link and endpoint routing never appear in the output. A payload with no Overview imports. | The existing share module tests |
| Preset store operations on the settings context | The Overview setter does nothing on a built-in. An edit to a linked preset sets dirty. Replace in place keeps the id. Duplicate copies the Overview and drops the link. Delete drops the link. | The settings context routing tests |
| Model id function (new, pure) | LM Studio and OpenAI body shapes. Extension and quant removal. De-duplication. A malformed body gives an empty list. | The reasoning capability parser tests |
| Prompt publish payload builder | Overview maps to description, tags, and models. Tuning is always present. Routing is absent. The models-required gate. | The other publish payload builder tests |
| Download state and the library download hook | The `prompt` kind gets none, refresh, and update. A dirty copy gets the confirm. Author fill on blank. | The download state and library download tests |
| Kind drift guards | `prompt` has labels, an icon, a size limit, a browse section, and card-type mapping. | The catalog kind and browse tab tests |
| Rendered Overview panel and import preview | The rail entry is absent for built-ins. Fields write through to the store. The preview shows the Overview. The overflow menu holds the right actions per preset type. | The Radix jsdom tests for Settings, the dev-router drift guard |

The server repo gets route tests for the `prompt` kind, the `models` column, and the model filter. The
Playwright suite is not part of this spec.

## Out of Scope

- Sharing a single prompt instead of a whole preset.
- A fixed tag vocabulary, model families, or a link to a model registry.
- A "does not work with" list or per-model notes.
- Thumbnails or any image on a prompt listing.
- Verified credit. The Author field is free text, and anyone can edit it in a file.
- A block or a credit when a player republishes another author's preset. Worlds have the same gap.
- Caps on Overview fields or on share code size.
- Contest entry for prompt listings.
- A "Prompts for this world" section on world listings.
- An update notice outside the community browser.
- Migration of stored presets. The new fields are optional and absent on old data.

## Further Notes

- The grilling session that produced this spec settled 24 decisions. The ones most likely to be questioned
  later: no caps (the user's call, to match worlds), origin exactly like worlds (no origin block in the
  share format), and one copy per listing (the library item model, not the world model).
- Replace in place is what keeps world and folder pins valid across an update. Do not mint a new id on
  re-download.
- The reachability probe discards the model id list today. Do not widen its return type; the id list is a
  separate on-demand call.
- Known risks, accepted: a forged Author, an unblocked republish, and an unbounded share code.
