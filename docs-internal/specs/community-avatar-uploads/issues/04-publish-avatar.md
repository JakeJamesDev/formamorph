# 04: Publish an Avatar from the Model Library

Status: ready-for-human
Base: fc4c1d75
Blocked by: 01, 02, 03
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: the integration point — it joins the client kind, the gate, the payload, the publish modal, and the server contract, and every browser surface must keep working for a fourth kind.

## Parent

[spec.md](../spec.md) — Community Avatar Uploads.

## What to build

A player publishes an Avatar from the Model Library and sees it under Avatars in Community Creations. The client catalog kinds gain `model` with labels Avatar / Avatars, which adds the row to the switcher from ticket 01. A Publish action sits beside the existing per-model actions in the library panel and the model details panel. It runs the gate from ticket 03 first: a failing model does not open the modal and the player is told which requirements failed; a passing model opens the existing kind-agnostic publish modal with a ready payload.

The payload builder: name from the VRM title, else the library name; description generated from the credited authors; thumbnail from the embedded VRM thumbnail, else absent; `contentData = { vrm, license, hash }`; no tags. Update-existing and delete use the existing flows. The listing's card, details, likes, comments, changelog, quarantine, takedown, and reports all work for the new kind because they are kind-agnostic; the details view additionally shows title, authors, and license terms from the stored content.

## Acceptance criteria

- [ ] `CATALOG_KINDS` includes `model`; labels Avatar / Avatars; the kinds drift guard against the server list is green; the Avatars row appears in both switcher layouts.
- [ ] Publish action present on every model in the library panel and model details panel; not present in the VRM viewer or character customization.
- [ ] A failing model: no modal; failed requirements named in copy.
- [ ] A passing model: publish modal opens with the built payload; publish succeeds against ticket 02's server and the listing appears under Avatars.
- [ ] Payload unit tests cover name fallback, generated description, thumbnail presence/absence, content shape, empty tags.
- [ ] Card and details render for the new kind; details show title, authors, and license terms; likes, comments, changelog, and moderation paths exercised in the existing browser suites for a `model` record.
- [ ] Update-existing and delete work for an Avatar listing.
- [ ] No export-shape change; four gates green; changelog In-Progress entry added.
