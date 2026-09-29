# Spec: Avatar Portrait Cards

Status: ready-for-agent
Spec session: avatar-portrait-cards — spec
Status note: Spans both repos. The server flag change lands first; FormamorphServer gets its own ticket under the same slug.

## Problem Statement

Avatars are tall character art, but Community Creations frames them like worlds:

| Surface | What shows today |
|---|---|
| Community Creations grid and card | A 16:9 landscape frame in the stacked layout. A full-body or square image loses its head and feet. |
| Listing details window | Wide art above the text |
| Profile creation rows | A landscape crop |
| Avatar with no art | The server's entity silhouette PNG, drawn as if it were the Avatar's real art |
| Library, Avatars tab | 2:3 art, but always Grid. The **Detailed** toggle shows on the tab and does nothing. |
| Library Avatar whose image could not be read or rendered | No art |

Entities already use the portrait split card on all of these surfaces. Avatars need the same portrait view.

## Solution

Avatars use the same portrait layout as entities, everywhere a listing or Library item is framed:

- Community Creations shows Avatars in the split card: 2:3 art on the left and text on the right. The grid, the loading skeletons, the details window and the profile rows follow.
- An Avatar with no art draws Morph art, in Community Creations and in the Library.
- The Library Avatars tab respects the Grid/Detailed toggle. In Detailed view it shows split cards with the VRM credit line ("By X.") as the text.
- An embedded VRM image that is not 2:3 keeps the top-anchored cover crop. Nothing new crops or re-encodes it.

## User Stories

1. As a player browsing Avatars in Community Creations, I want tall art frames, so that I can see the whole character instead of a wide strip.
2. As a player browsing Avatars, I want the same split card entities use, so that the character kinds look alike.
3. As a player browsing Avatars on a wide screen, I want three cards per row, so that the tall art stays large enough to judge.
4. As a player browsing Avatars on a medium screen, I want two cards per row, so that the cards do not get narrow.
5. As a player browsing Avatars on mobile, I want one card per row, so that the art stays readable.
6. As a player waiting for the Avatars tab to load, I want split-card skeletons, so that the grid keeps its shape when the listings arrive.
7. As a player, I want the Avatar's title and author at the top of the art, so that I read them the same way I do on an entity card.
8. As a player, I want the Avatar card's download and other art actions in the art's bottom-right corner, so that they sit where they do on an entity card.
9. As a player, I want the Avatar card to show its credit line as the description, so that I know who made the model.
10. As a player, I want an Avatar card with no credit line to show only the title, author and counts, so that the card does not invent text.
11. As a player opening an Avatar listing, I want the details window to put the art beside the author, counts, tags and actions, so that it matches the card I opened.
12. As a player opening an Avatar listing, I want the Avatar File license block to stay in the details window, so that I can check what the file permits before I download it.
13. As a player looking at a profile's creations, I want its Avatar rows cropped as portraits, so that the small image shows the face.
14. As a player, I want an Avatar with no art to show Morph art, so that it looks like a character and not like a broken image.
15. As a player, I want an Avatar's Morph art to stay the same every time I see it, so that I can recognize it.
16. As a player, I want Avatar Morph art to never show the entity silhouette, so that Avatars do not look like entity stand-ins.
17. As an Avatar author who publishes a VRM with no image, I want my listing to draw Morph art, so that it looks deliberate.
18. As an Avatar author who later adds an image, I want my listing to switch to the real art, so that the stand-in never hides my picture.
19. As an Avatar author with a listing published before this change, I want it to draw Morph art too, so that old and new listings look alike.
20. As an Avatar author whose VRM has a square storefront image, I want the portrait frame to keep the face in view, so that the card still shows my character.
21. As a player in the Library, I want the **Detailed** toggle on the Avatars tab to work, so that the tab behaves like the others.
22. As a player in the Library's Detailed view, I want Avatars in split cards, so that they match Library entities.
23. As a player in the Library's Detailed view, I want each Avatar card to show its credit line, so that I see who made each model.
24. As a player in the Library, I want my Grid or Detailed choice on the Avatars tab remembered, so that it stays when I come back.
25. As a player in the Library, I want an Avatar whose image failed to load or render to show Morph art, so that no tile is blank.
26. As a player in the Library, I want the GLB badge to stay on plain glTF Avatars in both views, so that I still see which files lack license data.
27. As a contributor reading the design system, I want the Community Card reference to show an Avatar in the split layout, so that the rule is visible in the showcase.
28. As a contributor, I want the design-system doc to say entities and Avatars get the split layout, so that the written rule matches the app.

## Implementation Decisions

**One switch for framing.** The thumbnail module's kind-to-aspect function returns portrait for the Avatar kind (`model`) as well as for entities. The community card, the details window, the browser grid and its skeletons already read this function, so they change with it. The profile creations row currently checks for entities directly; it moves onto the same function.

**Morph art for Avatars (Q2, Q5).** The server's kind rules gain the placeholder flag for `model`. A model published without a thumbnail then gets `placeholder: true`, exactly as an entity does. The server keeps storing the stand-in file; the client never fetches it for a flagged listing. The existing placeholder backfill covers `model` rows through the same rule, so older Avatar listings get the flag. The client's Morph-art predicate covers both kinds. The card's no-file fallback draws Morph art for an Avatar as it does for an entity.

**Rollout.** The server change deploys first. Until it does, unflagged Avatar listings still show the stand-in PNG, in a portrait frame. The client carries no compatibility code for that window.

**No new cropping (Q3).** Embedded VRM thumbnails keep the portrait fit: cover, anchored to the top. Import and publish do not crop or re-encode them to 2:3. Rendered thumbnails are already 2:3.

**Community card text (Q6).** Avatar listings carry the VRM credit line as their description and no tags. The split card shows them as they are. An empty credit line leaves the text side with only the title, author and counts. The card shell omits the empty line for Avatars only, through an opt-in (Q10).

**Library Detailed view (Q4, Q7).** The Avatars tab reads the per-tab layout state that already exists. In Detailed view it uses the split grid class entities use. Avatar records have no description, so the card derives the credit line from the record's license authors with the same helper the publish payload uses. The Avatars grid passes Morph art as its placeholder in both views (Q8).

**Morph art identity.** Library Morph art uses the record's id, as Library entities do. Community Morph art uses the listing id.

**Docs.** The Community Card section of the design-system doc changes "Give entities the split layout" to cover Avatars. The Morph-art lines cover Avatars too. The showcase reference gains an Avatar sample.

**Export shape.** Unchanged. No world or save field is added. The server listing row gains no column; `placeholder` already exists.

## Testing Decisions

- Tests assert what a player or client sees: which layout a card renders, whether Morph art or a file is drawn, and what the server returns. They never assert class strings or internal calls.
- **Server seam:** the existing HTTP-level placeholder-flag test. Publishing an Avatar with no thumbnail returns `placeholder: true`. Publishing one with a thumbnail returns `false`. Updating with a thumbnail clears it. The current "never flags an avatar" case flips. The backfill test gains a `model` row. Dictionaries still never flag.
- **Client community seam:** the existing card layout test and details-window layout test gain Avatar cases. An Avatar renders the split layout. A flagged Avatar draws Morph art and never requests the stored file. A world still renders stacked.
- **Client Library seam:** no render harness exists for the Library tabs, and none is added. The shared card-face test already covers split by aspect. The Avatars tab's Detailed view, credit line, GLB badge and Morph art are checked in the preview through the dev-router, at a real viewport, in both themes.
- Each new guard is proven by reinstating its bug: revert the aspect switch, the predicate or the kind rule, and watch the test fail.

## Out of Scope

- Cropping or re-encoding embedded VRM thumbnails.
- Description or tag inputs for Avatars in the publish dialog.
- License summaries on the card face.
- New stand-in art for Avatars on the server. The stored file stays the entity silhouette; the flag hides it.
- The Character Customization viewer and the Avatar picker in the enter flow.

## Further Notes

- Rulings, settled in the grilling session on 2026-09-29:

| # | Ruling |
|---|---|
| Q1 | Every surface that reads the kind-to-aspect switch gets portrait for Avatars. The profile rows move onto the switch. |
| Q2 | An Avatar with no art draws Morph art. |
| Q3 | Embedded thumbnails keep the top-anchored cover crop. No new cropping. |
| Q4 | Library Avatars get the Detailed split view. |
| Q5 | The server flags Avatar stand-ins, with backfill. The server ticket lands first. |
| Q6 | The community card shows the credit line; empty is fine. |
| Q7 | The Library Detailed card shows the credit line derived from license authors. |
| Q8 | A Library Avatar with no usable image draws Morph art in Grid and Detailed. |
| Q9 | In the Library Detailed view, the GLB chip (same tip) moves to the card's note line, as the Default persona badge does. Nothing overlays the split art. Asked by ticket 04. |
| Q10 | An empty Avatar description draws no line, on the Library Detailed card and on the community card. The card shell gets an opt-in to omit the empty line; worlds and entities keep the "No description available." fallback. Ticket 04 covers both surfaces. |
| Q11 | Avatar cards draw no "No tags" line, on the Library Detailed card and on the community card. Same kind of opt-in as Q10, on the tag row; worlds and entities keep it. Found by ticket 04; folded into its review. |
| Q12 | The listing details window also draws no description line for an Avatar with an empty credit line. Worlds, entities and dictionaries keep the fallback. Found by ticket 04's review; ticket 05. |

- Prior art: the Blank Entity Art effort built Morph art, the placeholder flag and its backfill for entities. This effort extends the same mechanism to Avatars.
