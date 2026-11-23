# 02: Server Stores And Uses Picks

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Repo: FormamorphServer. Routes, storage and the pick check.

## What to build

A world publish or update can carry `markPicks`: an ordered list of `{ entityId, mediaId }`, one per entity (spec, "Picks payload"). The server stores it per listing revision and the marking step uses a checked pick before the approximation for that entity. No route ever returns it (Q14).

- **Storage.** Per revision, beside the content. A publish or update without the field clears it. A held update keeps its picks with the pending content and applies them with it on approval.
- **Check.** A pick must name an entity in the content and a Media List image entry that is eligible (310k pixels, not animated, not SVG, decodable) and is that entity's own: a flat image in its gallery, or a Variant on the base Layer of a Layered Image in its gallery. A failed check uses ticket 01's approximation for that entity. Malformed input never fails the publish.
- **Order.** Ticket 01's order, with the pick in front of the approximation per entity.
- **Privacy.** No public listing, download, gated, update or author route returns the picks.
- **Docs.** The publish and update route tables in the server docs gain the field.

## Acceptance criteria

- [ ] A publish with picks, then a Supporter download: the picked images carry the account's mark, read back with the watermark reader, in place of the approximation's.
- [ ] An update without `markPicks` clears them, and the download falls back to the approximation.
- [ ] A held update's picks apply only when the update is approved.
- [ ] A pick naming an overlay Variant, another entity's image, a small image, an animated image, an SVG or a missing id falls back to the approximation for that entity.
- [ ] Malformed `markPicks` (not an array, wrong fields) publishes normally with no picks stored.
- [ ] No route response contains the picks: listing, download, gated, update and author routes checked.
- [ ] Removing the pick check makes the bad-pick test fail.
