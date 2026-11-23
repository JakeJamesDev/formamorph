# Supporter Mark Picks

Status: ready-for-agent
Spec session: supporter-mark-picks — spec

Spans both repos: the Formamorph client works out the picks, and FormamorphServer stores them and marks by them. Replaces R2 of the server's `large-supporter-worlds` spec.

## Problem Statement

A Supporter world carries the account's watermark in 5 images: the cover and the 4 largest images of at least 310k pixels. Location backdrops are larger than character art, so in a typical world every mark lands on a backdrop. In Sunmeadow, the marks go to Your House and Town Square (day and night), and no character image carries a mark. Character art is what people repost, so a leaked character traces to no account.

Layered Images make it worse. A Variant on an overlay Layer competes for a mark like any image, but a mark on an overlay does not survive once the Layers are stacked and screenshotted. Only the base Layer keeps it.

## Solution

Characters come first. The cover keeps its mark, and the other 4 go to the characters' start pictures, in the World Editor's entity order. For a Layered Image, the mark goes on the base Layer's start Variant. Marks that no character can use go to the largest backdrops, as today.

The client works out each character's start picture when it publishes or updates a world, because only the client can check Visibility rules. It sends the picks with the listing. The server keeps them private and marks by them. A listing without picks gets the server's own approximation.

## Rulings

| # | Ruling |
|---|---|
| Q1 | Characters first. Backdrops get the marks left over. |
| Q2 | Only a Layered Image's base Layer gets a mark, never an overlay. Matches the Mascot ruling (supporter-content Q28). |
| Q3 | A world keeps 5 marked images. |
| Q4 | A character's mark goes on its start picture: the gallery slot and Variants its starting values show, as Preview As shows them. |
| Q5 | When the base Layer has several Variants, only the start Variant gets a mark. |
| Q7 | With more characters than marks, the first entities in the World Editor's list get them. |
| Q9 | The client works out the picks on publish and on update and sends them with the listing. The world file does not change. |
| Q10 | Marks that no character can use go to the largest backdrops, as today. |
| Q11 | A listing with no picks (published before this change, or from a 3.8.0 client) gets the server's approximation: each entity's first gallery slot without a Visibility rule, through its base Layer's first Variant without a rule. |
| Q12 | The cover keeps its own mark, so characters get the other 4. |
| Q13 | A marked image can be spotted in one copy (lossless WebP, about 4 times the source size). Accepted. |
| Q14 | Picks are server-only. No listing, download, gated or update route returns them. |
| Q15 | With no markable cover, a 5th character takes the free mark. |

Q6 and Q8 were not used in the grill.

## User Stories

1. As staff, I want a leaked character image to name the account that downloaded it, so that I can act on the leak.
2. As staff, I want the mark on a Layered Image character to survive a screenshot of the stacked picture, so that a leak through screenshots still traces.
3. As staff, I want the cover to keep its mark, so that the image most likely reposted with a listing still traces.
4. As staff, I want the main cast marked before minor characters, so that the marks cover the art people repost most.
5. As staff, I want a world with few characters to spend its spare marks on the largest backdrops, so that no mark goes unused.
6. As staff, I want a world with no cover to mark a 5th character, so that every world carries 5 marks.
7. As staff, I want existing Supporter worlds to get character marks without being republished, so that the change protects them at once.
8. As staff, I want publishes from 3.8.0 clients to get character marks too, so that an old client never weakens a listing.
9. As a world author, I want the mark on my character's start picture, so that the picture players see first is the one traced.
10. As a world author, I want my entity order in the World Editor to decide which characters get marks, so that I control it without a new setting.
11. As a world author, I want my world file unchanged, so that publishing needs nothing new from me.
12. As a world author, I want every image without a mark delivered byte for byte, so that my world looks the way I made it.
13. As a world author, I want a picks failure never to block a publish, so that I can always share my world.
14. As a Supporter, I want my download no larger than today, so that the change costs me nothing.
15. As the owner, I want the picks hidden from every route, so that a leaker cannot read which images carry the mark.
16. As the owner, I want overlay Variants never marked, so that no mark is spent where it cannot survive.
17. As the owner, I want a pick that names a missing, small, animated or SVG image to fall back to the server's own pick for that character, so that a bad pick never leaves a character unmarked.
18. As the owner, I want an image shared by two characters to count once, so that the next character takes the free mark.
19. As the owner, I want every cached marked copy retired by this change, so that no account keeps a copy marked the old way.
20. As the owner, I want Mascots unchanged, so that every Mascot layer stays marked and scrambled.
21. As the owner, I want a world staff marks Supporter-only after publishing to already hold its picks, so that the toggle needs no republish.

## Implementation Decisions

- **Picks payload.** A world publish and a world update carry a new top-level field `markPicks` beside `contentData`: an ordered list of `{ entityId, mediaId }`, one entry per entity in World Editor order. `mediaId` names the Media List image entry of the entity's start picture: a flat image, or the start Variant of a Layered Image's base Layer. An entity whose start picture draws nothing has no entry. Every world publish sends picks, because staff can mark any listing Supporter-only later.
- **Start picture on the client.** The client resolves each entity's start picture as the World Editor does: the first gallery slot whose rule holds at the entity's starting values, read through the world's gate input; then, for a Layered Image, the Variant its base Layer shows under the same reads. It reuses the entity look reads that drive Preview As and the flattened picture (Q44 of the Layered Images spec), so the mark lands on the picture the editor and library show.
- **Pick edge cases (ticket 03 rulings, 2026-11-22).** The gate input is the World Editor's with no Opening drawn. The start picture is the first slot whose own Visibility rule holds and that draws; unlike the library's primary picture, the slot rule counts. No entry is sent, and no later slot is tried, when that slot is an embedded image or embedded Layered Image, or when its base Layer shows no Variant at the start. The server's approximation then covers that entity. Two entities that name one image both send it; the server counts it once.
- **Approximation edge cases (ticket 01 rulings, 2026-11-23).** The server walks entities in World Editor tree order, as the client does, and counts every entity, persona ones included. A slot that resolves to nothing is skipped as if absent. When the first ruleless slot that resolves has no ruleless base Variant, or its image is ineligible, that character is skipped. The backdrop fill skips every overlay Variant; an image also used as a flat slot or a base Variant stays in the pool.
- **Picks storage edge cases (ticket 02 rulings, 2026-11-23).** Picks belong to the content: an update replaces or clears them only when it carries `contentData`, and a metadata-only update leaves them alone. Held picks exist only with held content. A malformed entry is dropped and the rest kept; a non-array `markPicks` drops them all.
- **Base Layer.** The base Layer is the first Layer that has a Variant, the one that sizes the canvas. Layers draw from index 0 upward.
- **Server storage.** The listing stores the picks per revision. A publish or update without the field clears them, so the listing falls back to the approximation (Q11). No route returns the field (Q14).
- **Server picker.** The world path of supporter processing replaces "cover + 4 largest" with:
  1. The cover, when it is markable (not linked, animated, SVG or undecodable).
  2. Characters in pick order: each pick, checked, until the character budget (4, or 5 with no markable cover) is spent. A check failure, or an entity with no pick, uses the approximation for that entity.
  3. The largest remaining eligible images, by width × height, ties in first-appearance order, for any budget left.
  - An image is eligible as today: at least 310k pixels, not animated, not SVG, decodable. An image already chosen counts once; the next candidate takes the free mark.
- **Approximation (Q11).** For an entity without a usable pick: its first gallery slot without a Visibility rule. When that slot is a Layered Image, the first Variant without a rule on its base Layer. It handles every gallery shape the server can meet: a `mediaId` link, an embedded image, an embedded Layered Image, and the legacy single-portrait field.
- **Mark and encoding.** Unchanged: lossless WebP, no scramble for worlds, a marked Media Entry drops `hash` and takes `type: image/webp`.
- **Cache.** The world processing version salt changes, so every cached world copy is retired.
- **Old clients.** A 3.8.0 client sends no picks and gets the approximation. Nothing in the response shape changes.

## Testing Decisions

Good tests check what leaves the server and what the client sends, never the picker's internals. Each guard must fail when its rule is undone.

1. **Client publish payload.** Small world fixtures through the world publish payload:
   - An entity whose slot 0 has a rule that fails at the start sends its first slot that holds.
   - A Layered Image sends its base Layer's start Variant, never an overlay's.
   - Picks follow the World Editor's entity order, and an entity that draws nothing sends none.
   - The world's `contentData` is unchanged.
   - Prior art: the publish and portable Layered Image tests, and the entity look tests.
2. **Server supporter processing.** World fixtures with real images, each mark read back with the watermark reader:
   - The cover and the 4 picked characters carry the account's mark; a backdrop larger than all of them does not.
   - No markable cover: 5 characters carry marks.
   - Fewer usable characters: the largest backdrops take the rest.
   - A bad pick (missing, small, animated, SVG, an overlay id) falls back to the approximation for that entity.
   - No picks: the approximation, including a slot-0 rule skip and a Layered Image base Layer.
   - A shared image counts once.
   - Mascot tests stay green unchanged.
   - Prior art: the supporter processing and watermark read-back tests.
3. **Server routes.** Publish and update store picks per revision, and an update without picks clears them. No public listing, download, gated or update route returns them. Prior art: the gated-route and author listing tests.

## Out of Scope

- Changes to the watermark or scramble algorithms.
- Hiding which images carry a mark (Q13).
- Marking more than 5 images per world (Q3).
- An author-facing setting for which characters get marks (Q7 uses entity order).
- Marking more than one Variant per character (Q5).
- Location art priority beyond "largest backdrops get the rest".
- Mascots.

## Further Notes

- Evidence, 2026-11-22, on Roxanne's Layered Image in Sunmeadow: a mark on the base Layer read back from the stacked picture after halving, a 75% scale, WebP q80 and a 2 px shift. A mark on Carry read only from an exact copy; a mark on the thin Body Edge never read.
- Sunmeadow today: 340 images, all past the 310k floor; 114 backdrops at 2.1 MP tie for the 4 marks; character art is 832×1216.
- Measured cost on the dev PC: a marked 832×1216 image is about 0.66 MB of lossless WebP, about 0.1 s to mark. The API server is slower and unmeasured. Q3 keeps the count at 5, and character art is smaller than backdrops, so a typical download gets smaller.
- The server's `large-supporter-worlds` spec still reads "Not deployed" in its Status note; the deploy log shows it deployed on 2026-11-20.
