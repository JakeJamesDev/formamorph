# Downscale Presets

Status: done
Status note: Closed 2026-10-26. Tickets 01 to 02 done; last landing bad314892. Review: one help sentence corrected (b37b16c1f). Gates green on 2026-10-26.
Spec session: downscale-presets — spec

## Problem Statement

An author who uploads or generates art sees the World Editor offer **Downscale** for images "larger than recommended", and an **Over Budget** badge on the Media tab. The recommendation behind those words is a set of per-slot budgets (a long edge and a byte count) and one lossy quality, set when the app's art was small JPEGs. Nobody has measured them against what the app shows in play or against the art the app now generates.

Measured on 2026-10-26, the presets miss in three ways:

- **Downscale leaves lossless art alone.** It touches only an image over its slot's budget. A generated 1216×832 backdrop stored as lossless WebP is 0.9 to 1.2 MB, under the 1.5 MB background budget, so Downscale keeps it lossless. The same image at the editor's own lossy quality is 95 to 135 KB. The Bundled Worlds Expansion ships its worlds through Downscale (its ticket 17), so every shipped backdrop would stay at full size.
- **The entity cap costs quality for no size.** A generated 832×1216 portrait is resampled to 700×1024. On a phone at device pixel ratio 3, and in the zoom viewer, that resample costs 3 to 6 dB. A full-size portrait at quality 0.60 scores at or above the 1024 one at quality 0.90, at half the bytes. The cap saves 13 to 16 KB per portrait, about 2 MB across the whole expansion.
- **The budgets and the estimate are far from real sizes.** The byte budgets are 5 to 7 times what the editor's own encoder produces at each cap, so a 1 MB lossy backdrop passes without a word. The Downscale prompt predicts the result at half the source bytes; for a lossless source the real factor is about 0.08, so the prompt says "~570 KB" for a run that yields 95 KB.

Authors also cannot find the numbers. The help page names only the Map budget. The image panel shows a byte budget and no long edge.

## Solution

Keep the editor's one lossy quality, re-aim what Downscale acts on, resize the budgets to the measured art, and tell authors the numbers.

- **Downscale re-encodes every lossless or PNG image, whatever its size, plus every image over its slot's budget** (Q2). A lossless source always comes out as lossy WebP. **Optimize** keeps its meaning: lossless WebP at the same resolution for any convertible image.
- **Quality stays 0.82** (Q3). It sits at the knee of the measured curve: 0.90 costs 50 to 70 percent more bytes for about 2 dB; 0.75 saves 25 percent for about 1.6 dB.
- **New budgets** (Q5 to Q7, Q10): thumbnail 1024 px and 200 KB; entity 1280 px and 250 KB; background 1920 px and 900 KB; map 2560 px and 1.5 MB. The entity long edge rises so an SDXL portrait is never resampled. Each byte budget is about three times the real size of quality-0.82 art at that cap, so normal art never trips it and an oversized JPEG or a quality-0.95 WebP does.
- **The Downscale estimate uses a factor per source format** (Q9): about 0.1 for a lossless or PNG source and about 0.5 for a lossy one.
- **Docs and the image panel state each slot's recommendation as both numbers** (Q8), in the form "Up to 1280 px on the long edge, about 250 KB".
- **No bundle ceiling** (Q4). The presets follow the play-size measurements; the shipped total is reported, not capped.
- **No grandfathering** (Q11). Existing images meet the new budgets or show the badge.

## Rulings

- **Q1** Measurements rest on four real images from the app's InvokeAI provider (Illustrious Nova Kemono XL 8.0, two 1216×832 backdrops, two 832×1216 portraits), not only on repo samples. (user; generated 2026-10-26 in an agreed GPU window)
- **Q2** Downscale re-encodes every lossless or PNG image plus every over-budget image. Budgets stay as the warning threshold.
- **Q3** The lossy quality stays 0.82, one value for every slot.
- **Q4** No bundle ceiling. Per-image quality decides the presets.
- **Q5** Entity long edge 1280.
- **Q6** Thumbnail long edge stays 1024.
- **Q7** Byte budgets tighten to about three times the measured quality-0.82 size at each cap: thumbnail 200 KB, entity 250 KB, background 900 KB, map 1.5 MB.
- **Q8** The help page and the image panel state both numbers per slot.
- **Q9** The Downscale prompt estimates with a per-format factor: lossless or PNG about 0.1, lossy about 0.5.
- **Q10** Background long edge stays 1920.
- **Q11** No grandfathering of stored images. The new budgets apply to every world.
- **Q12** Bundled Worlds Expansion ticket 17 (Ship-Time Downscale) blocks on this effort's trigger-rule ticket, so one rule serves the editor and the build step.
- **Q13** Shared understanding confirmed. The prompt's sentence for lossless images under budget and the unchanged Optimize button are the spec's decisions (Implementation Decisions › Prompt copy).

## User Stories

1. As an author, I want Downscale to turn my lossless or PNG art into lossy WebP whatever its size, so that one run makes my world small.
2. As an author, I want Optimize to keep meaning lossless WebP at full resolution, so that I can shrink without losing a pixel when I choose to.
3. As an author, I want a generated portrait to keep its native resolution through Downscale, so that it stays sharp on a phone and in the zoom viewer.
4. As an author, I want the Over Budget badge to appear on an image that is large for its slot by today's art, so that the warning means something.
5. As an author, I want normal generated art at the editor's quality to never show Over Budget, so that I am not warned about art the editor itself made.
6. As an author, I want the Downscale prompt's size estimate to land within about two times the real result, so that I can judge the offer before I accept it.
7. As an author, I want the image panel to state each slot's long edge and byte recommendation, so that I know the target before I upload.
8. As an author, I want the help page to list every slot's recommendation in one table, so that I can look the numbers up.
9. As an author, I want the Media tab's Over Size Budget filter and the Test Bench to use the same budgets as Downscale, so that the three agree.
10. As an author, I want an existing world to show the new badges after the update with no migration, so that nothing in my file changes until I act.
11. As an author, I want a Downscale run on a lossless-only world to be offered and to change every image, so that the button never does nothing.
12. As an author, I want the prompt to say why each image is listed, larger than recommended or lossless, so that the count matches what the run will touch.
13. As a player, I want a bundled or downloaded world's backdrop to look the same at quality 0.82 as it did lossless on a 1920 display, so that the size cut costs me nothing I can see.
14. As a player, I want a portrait to stay sharp on a high-density phone screen, so that the zoom viewer shows the art, not the resample.
15. As a player on a slow connection, I want a published world's images to be tens of kilobytes each, so that a world downloads in seconds.
16. As the bundled-worlds build step, I want to call the editor's Downscale rule and get lossy WebP for every lossless source, so that the shipped worlds are small without a rule of my own.
17. As the bundled-worlds build step, I want the budgets and quality in one place, so that the shipped bytes follow the editor's presets automatically.
18. As a maintainer, I want the caps, the quality and the estimate factors defined once each, so that a future re-measurement changes one constant per lever.
19. As a maintainer, I want the measurement method recorded, so that the next re-evaluation repeats it instead of guessing.
20. As a moderator reviewing a listing, I want generated art to arrive at tens of kilobytes per image, so that the Publish Size meter stays green for worlds with dozens of images.

## Implementation Decisions

- **One trigger rule.** The scan that decides what Downscale acts on marks an image as a Downscale target when it is over its slot's long edge, over its slot's byte budget, or stored lossless (lossless WebP or PNG). Every Downscale entry point, upload, world load, publish, export, import batch and the bundled-worlds build step, reads the same scan. Optimize keeps its own convertible rule.
- **The lossless test.** A PNG or BMP counts as lossless by format. A WebP counts as lossless by its container: the image chunk is VP8L, also inside a VP8X wrapper. A JPEG, a GIF or a lossy WebP never does (ticket 01 ruling). An animated image keeps its current handling: Downscale re-encodes it frame by frame when the browser can decode it and otherwise leaves it, as today.
- **Quality.** One constant, 0.82, for every lossy encode. No per-slot quality.
- **Budgets.** The per-slot table becomes: thumbnail 1024 px and 200 KB; entity 1280 px and 250 KB; background 1920 px and 900 KB; map 2560 px and 1.5 MB. The table stays the one source the scan, the Media tab, the Over Size Budget filter, the Test Bench size rule and the image panel read.
- **Estimate.** The Downscale prediction multiplies the source bytes by about 0.1 when the source passes the lossless test and by about 0.5 otherwise, over budget or not, then by the area ratio of the cap fit. The Optimize prediction is unchanged. The constants are named and commented with the 2026-10-26 measurement.
- **Prompt copy.** The scan's description names both reasons. When every listed image is over budget the lead stays "N images larger than recommended". When every listed image is lossless and within budget it reads "N lossless images Downscale would shrink". A mixed set reads "N images worth optimizing — K larger than recommended, M lossless". The Downscale button exists whenever the scan lists a Downscale target, and its sentence names the count it will touch. The Optimize button and its sentence are unchanged. The copy follows the Writing Guide and the copy-sweep skill.
- **Image panel.** The budget line reads "Up to 1280 px on the long edge, about 250 KB" with the slot's values. The Over Budget badge keeps its rule, now against the new budgets.
- **Help page.** The World Editor Media page gets one table of the four slots with both numbers, and the Map Background section points at it instead of carrying its own numbers. The Optimize Images section says what Downscale does to a lossless image.
- **Shipped worlds.** The bundled-worlds build step (expansion ticket 17) calls the same scan and encode, so it needs no rule of its own; its ticket blocks on this effort's trigger-rule ticket (Q12).
- **No shape change.** No world or save field changes. No migration. Existing stored images are judged by the new table on the next scan.
- **No settings surface.** The values are constants, not settings. An author who wants other values uses an external tool.

## Testing Decisions

- A good test drives the scan and the apply through an injected fake codec and checks which images were re-encoded, at what long edge, and what the prompt offered. It never asserts on pixels or on a real encoder's bytes.
- **Seam one: the scan and apply over the fake codec.** Existing suites cover the trigger rule, the caps and the estimate. New cases: a within-budget lossless WebP and a within-budget PNG are Downscale targets; a within-budget JPEG is not; an 832×1216 portrait keeps its size under the entity cap; a 1300 px entity image is resampled to 1280; each slot's byte budget flips the oversized flag at its new value; the estimate uses the lossless factor for a PNG or lossless WebP and the lossy factor for a JPEG. Each new check is shown to bite by reinstating the old rule or value once.
- **Seam two: the prompt hook's rendered copy and buttons.** Existing suite. New cases: a lossless-only within-budget set offers Downscale with the lossless sentence; a mixed set names both counts; the predicted size for a lossless source is about a tenth of the source.
- **Seam three: the media index's over-budget flag** against the new table, through its existing suite.
- The help page and the panel line are checked by the copy sweep, not by a test (user, seams question).
- Prior art: the fake-codec suites for the optimize core, the prompt hook suite, the media index suite.

## Out of Scope

- A per-slot or author-settable quality.
- A new encoder, a smarter encoder setting, or AVIF.
- Deduplicating a thumbnail that repeats a location image (Veilwood stores 756 KB twice). Named, not fixed.
- Re-encoding the stored bundled world files. They stay lossless (expansion Q22); the build step ships the lossy form.
- Grandfathering or migrating stored images.
- Changing the publish limits or the Publish Size meter bands.
- Changing what Optimize (lossless) does.

## Further Notes

- **Where the presets live today:** the lossy quality in the encode core; the per-slot table in the image-slot module; the trigger in the optimize core's scan; the estimate factors in the optimize module; the author copy in the prompt hook, the app bar copy and the media panels; the help text in the World Editor Media page.
- **Display facts.** The location backdrop is full-viewport cover with the overlay at 0 by default; the side panels are 60 percent theme color over it. A 1216×832 backdrop is upscaled 1.58× on a 1920 display. The entity portrait sits in a quarter-width panel at a 1.2 aspect; at 1920 wide the image is about 368×538 CSS px; on a phone at ratio 3 about 1170×1700 device px; the zoom viewer shows 1:1 and beyond.
- **Method.** Four real images through the app's provider, encoded with libwebp at every quality from 60 to 90 and at long edges 1216, 1024 and 768, checked against Chromium's own canvas encoder (within 2 KB at every point). Each encode was compared with the source at each play view (desktop 1920 at ratio 1 and 1.5, 2560, phone at ratio 3, zoom 1:1, and under a 60 percent light or dark panel) by SSIM on luma and PSNR. Light and dark measured the same at every point.
- **Numbers at quality 0.82, native edge:** backdrops 95 and 135 KB; portraits 65 and 86 KB; lossless 884 KB to 1.24 MB. Portraits at the old 1024 cap: 52 and 70 KB.
- **Whole-bundle estimate** for the expansion's about 210 images at quality 0.82 and native edges: about 19 MB raw, about 26 MB as base64 in the world files, against 11.8 MB of bundled worlds today.
- The full tables, the crops at 200 percent and the scripts are in the main checkout's `.scratch/downscale-eval/` and in the effort's side-session notes. They are evidence, not a deliverable.
- Grill rulings Q1 to Q13 were settled on 2026-10-26.

## Comments

**Ticket 01 rulings (2026-10-26, spec session).** The lossless test is by stored format: PNG, BMP and VP8L WebP are Downscale targets at any size; a static GIF stays out within budget, since its pixels are already quantized and Optimize converts it. An animated image, lossless frames or not, is a target only when over budget, as today. VP8X detection walks the RIFF chunks and calls the image lossless when the image chunk is VP8L. The estimate factor follows the same test. Copy: a set with no Downscale target shows no Downscale button and keeps "N images lossless WebP would shrink"; with lossless targets the lead names both counts as the Implementation Decisions state, and the Downscale sentence reads "Downscale also shrinks K of them (~X)".

**Test Bench size rule (2026-10-26, ticket 01 evidence).** The rule checked thumbnail, entity and location images only, so it could not agree with the scan on Map Background or dictionary covers. Ticket 01 widens it to the media index's slot list, so the rule and the scan read one list. Its per-finding wording is unchanged.

**Close follow-up (2026-10-26).** The byte budgets are stored 1024-based (204,800; 256,000; 921,600; 1,572,864 bytes), so the panel line, the help table and the stored size all print in the same KB. The panel line drops "about": the badge flips at the exact number. "Size budget" is the one term in the help page.
