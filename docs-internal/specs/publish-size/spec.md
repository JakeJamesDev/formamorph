# Publish Size

Status: ready-for-agent
Status note: Tickets 01–06 cut 2026-09-10 under `issues/`. Further additions go to the spec first, then to a new ticket.

## Problem Statement

An author cannot see how big a world is until publishing fails. The server refuses a world over its limit only after the whole body has uploaded, and the refusal is a raw error toast. Nothing in the World Editor shows the number, and nothing warns as it grows.

The size problem is hidden behind a different rule. An entity may carry two uploaded images. That cap exists to keep worlds small, but it rations the wrong thing: it stops an author who wants a gallery on one main character, and it does nothing about a world with two hundred entities at two images each. The cap also blocks AI generation once both slots are full, and asks which image to replace.

The server limit itself is wrong for where the server lives. The code allows 200 MB, but any Cloudflare proxy in front of the API allows 100 MB on the plans we would use. The old host ran behind such a proxy, so the effective limit for most of the workshop's history was 100 MB. Our host is direct today, and proxying it later would silently halve the limit.

## Solution

The World Doctor shows a **Publish Size** bar. It fills as the world grows, reads the figure against the limit, and steps from green to amber to red. At the limit it raises a warning finding, so the flask badge counts it. Publish refuses an over-limit item before any upload, for every kind, with a message that names the kind and its limit.

The per-entity image cap goes away. An entity carries as many uploaded images as the author wants. Generation always adds a new image. The author balances images across entities against one visible number, and decides whether the world stays local or gets published.

The server's world limit becomes 100 MB. The client mirrors it as one constant. No world is grandfathered: the one published world above 100 MB stays downloadable and playable, and its author must trim it before the next update.

## User Stories

1. As a world author, I want to see my world's publish size in the World Doctor, so that I know how much room I have before I hit the limit.
2. As a world author, I want the size to read as a figure against the limit, such as "12.4 MB of 100 MB", so that I can judge headroom without arithmetic.
3. As a world author, I want the bar to be green while there is plenty of room, so that I can ignore it while it does not matter.
4. As a world author, I want the bar to turn amber at 60% of the limit, so that I get an early signal while I still have choices.
5. As a world author, I want the bar to turn red at 90% of the limit, so that I know publish is about to fail.
6. As a world author, I want the bar to stop at full when the world is over the limit, so that the readout stays legible.
7. As a world author, I want an over-limit world to raise a warning finding, so that the flask badge tells me without opening the Bench.
8. As a world author, I want the finding to name the size and the limit, so that I know how much to cut.
9. As a world author, I want the finding to open the Overview, so that I land somewhere sensible when I click it.
10. As a world author, I want the finding to have no one-click fix, so that nothing deletes my images for me.
11. As a world author, I want the bar in the Bench Popover, so that quick triage shows it.
12. As a world author, I want the bar in the full Test Bench panel, embedded or docked, so that every chrome agrees.
13. As a world author, I want the bar in the mobile Bench sheet, so that a phone shows the same number.
14. As a world author, I want the bar to update after I stop editing, so that typing a name never stalls.
15. As a world author, I want the measured number to be the number the server checks, so that green never lies.
16. As a world author, I want a tip beside the bar that explains what is measured, so that I know why the export file is larger than the bar says.
17. As a world author, I want a linked image to add only its URL to the size, so that linking stays the cheap option.
18. As a world author, I want the size to count every embedded image, sound, and model in the world, so that no asset hides from the bar.
19. As a world author, I want an over-limit publish to refuse before any upload, so that I do not wait through a hundred-megabyte upload that ends in an error.
20. As a world author, I want the refusal to name the kind and its limit, so that I know what to change.
21. As a world author, I want the same refusal for entity cards and dictionaries, so that no kind fails late.
22. As a world author, I want to publish an entity card up to 25 MB, so that the client never refuses what the server would accept.
23. As a world author, I want to publish a dictionary up to 5 MB, so that the client never refuses what the server would accept.
24. As a world author, I want to upload as many images to an entity as I like, so that a main character can have a gallery.
25. As a world author, I want to give one entity many images and another one image, so that I spend the world's room where it matters.
26. As a world author, I want the "Upload limit reached" note gone, so that no dead rule is explained to me.
27. As a world author, I want AI image generation to add a new image to the entity, so that I keep every image I have.
28. As a world author, I want generation never to ask which image to replace, so that generating is one click.
29. As a world author, I want to replace an existing image through its own slot, so that replacing stays possible.
30. As a world author, I want a multi-file drop to add every file, so that no file is silently dropped.
31. As a world author, I want a location to keep one background image, so that the image cap removal changes nothing there.
32. As a world author, I want the per-image size caps and the downscale prompt to work as before, so that one huge image still gets flagged.
33. As a world author, I want the oversized-image finding to work as before, so that per-image advice and total-size advice stay separate.
34. As a world author, I want a world imported with more than two images per entity to load as before, so that old files keep working.
35. As a world author, I want the changelog to tell me the cap is gone and the bar is new, so that I learn about both from one entry.
36. As a world author, I want the changelog to tell me the publish limit is now 100 MB, so that the change is not a surprise.
37. As a player, I want a published world above the new limit to stay downloadable and playable, so that lowering the limit deletes nothing.
38. As a server operator, I want the world limit to be 100 MB, so that a Cloudflare proxy never sits below it.
39. As a server operator, I want the limit refused on create and on update, so that an over-limit world cannot be grown past it.
40. As a server operator, I want the disk write guard to match the kind limit, so that no second number drifts.
41. As a server operator, I want the body parser cap to sit above the kind limit with room for the envelope, so that a world just under the limit is not refused by the parser first.
42. As a server operator, I want the server docs to state the new limit, so that the capability map is true.
43. As a developer, I want one client table of publish limits by kind, so that the bar, the finding, and the refusal read one source.
44. As a developer, I want the byte measure to be a pure function over the content, so that it is tested without a browser.
45. As a developer, I want the size computed off the main thread, so that a hundred-megabyte world does not freeze the editor on every pass.
46. As a developer, I want the size finding to enter the Bench the way the stat-code check does, so that the pure rule engine stays synchronous.
47. As a developer, I want the bar rendered by the World Doctor list, so that all three chromes get it with no per-chrome code.
48. As a developer, I want the Triggers instrument unaffected, so that a tester never disagrees with play.
49. As a developer, I want no export-shape change, so that no version bump or migration follows.
50. As a developer, I want the readout and the limit to use one byte convention, so that "100 MB" on the bar is the server's 100 MB.

## Implementation Decisions

**Client publish limits table.** One pure module owns the per-kind limits: world 100 MiB, entity 25 MiB, dictionary 5 MiB, model 64 MiB. It mirrors the server's per-kind rules. It exports the byte measure, the band function, and the refusal message builder. Nothing else in the client states a limit.

**The measure is the server's measure.** The server checks the byte length of the compact JSON serialization of the content. The client measures the same: compact serialization of the same content object, byte length in UTF-8. Not the pretty-printed export file, not the whole request body. The tip beside the bar says the export file is larger because it is formatted for reading.

**Off-thread serialization.** The measure runs in the existing JSON file worker with no indentation, returning the byte count. The World Editor pass reuses the Bench's debounce: the size recomputes once the world has been still for the same interval the rules use. The bar shows the last known figure while a new one is pending, and nothing before the first result.

**Out-of-band finding.** A `world-too-large` head with severity warning, section overview, no check, no fix, following the stat-code-execution pattern. A hook produces the finding when the measured bytes reach the limit, and the orchestrating hook merges it with the rule findings. Because it is not in the rule catalog, Triggers never runs it and the rule count does not include it. The message states the measured size and the limit.

**Bands.** Ratio is bytes over the kind's limit. Green below 0.6, amber from 0.6 to below 0.9, red from 0.9. The fill clamps at 1.0. The readout formats both numbers with 1024-based units to one decimal, and shows a whole number bare, so "100 MB" agrees with the server's "100MB" wording. The existing 1000-based image formatter is not used here.

**Where the bar renders.** The World Doctor list component gets an optional size prop and renders the bar above the findings, after the new-count row. The popover, the panel tab, and the mobile sheet all render that list, so they all get the bar. The Issues props bundle grows by one field; the orchestrating hook populates it.

**Copy.** Label "Publish Size". Readout "<size> of <limit>". The tip icon carries what is measured, that a linked image adds only its URL, and that the export file is larger. Finding message: "The world is <size>, over the <limit> publish limit." Refusal message: "<Kind label> is <size>, over the <limit> publish limit." All copy follows the two-layer rule and uses defined terms.

**Pre-flight refusal.** The publish service measures the payload's content before authentication or fetch and throws the refusal message when it exceeds the kind's limit. No request is sent. The publish dialog shows the message as it shows any publish error. This covers every kind that goes through the publish service.

**Image cap removal.** The embedded-image limit constant, the widget prop that carries it, and every branch that reads it go away. Embedding is always allowed for the entity widget. Multi-file drop takes every file. Generation targets a new slot always for an entity, so the "Replace which image?" dialog never opens there. A location has one slot, so its generation keeps asking whether the new image replaces the background. The "Upload limit reached" note and the swapped paste placeholder go away. Locations keep their single slot by slot count, unchanged.

**Server change.** The world kind's content limit becomes 100 MiB. The disk write guard becomes 100 MiB and its message says 100MB. The world-route body parser limit becomes 120mb, so the thumbnail and envelope fit around a world at the limit. Error text keeps its form. Server docs and the capability map say 100 MB. No grandfather clause: an update whose new content exceeds the limit is refused like any other.

**Changelog.** One user-facing entry covers the bar, the finding, the pre-flight refusal, the cap removal, and the new limit. One backend entry in the server repo's changelog covers the limit change.

**Export shape.** Unchanged. Bench state stays local. No field is added to the world or the save.

## Testing Decisions

A good test calls the seam and checks what an author or the server would see: the bytes, the band, the message, the rendered readout, the refused request, the appended image. No test asserts on internal state or on how the worker is invoked.

**Publish limits module.** Byte measure equals the UTF-8 byte length of the compact serialization for content with multi-byte characters and a data URL. Band boundaries at exactly 0.6 and 0.9 of each kind's limit. Ratio clamps at 1.0. Refusal message names the kind label, the size, and the limit. Prior art: the pure module tests under the Bench directory.

**Size finding hook.** Renders with a world under the limit and yields no finding; with a world at the limit yields one warning finding with the message; the rule count is unchanged. Prior art: the stat-code check hook tests.

**World Doctor list.** With a size prop, the readout text and a data attribute for the band are present; without it, no bar. Prior art: the Bench popover and Test Bench render tests.

**Publish service.** Over-limit content for each kind rejects with the refusal message and no fetch is called. Content at the limit calls fetch. Prior art: the existing publish tests with the fetch mock.

**Image widget.** Generation with every slot filled adds a new image and no replace dialog appears. A drop of three files onto an entity with two images yields five. No "Upload limit reached" text renders. Prior art: the existing generate tests for the widget, rewritten rather than deleted.

**Server.** Kind validation tests: a world at 100 MiB plus one byte is refused on create and on update with the exact message; a world at 100 MiB is accepted. Prior art: the existing kind validation tests.

**Guards that must bite.** Each new test is run once with its bug reinstated: the old constant, the old band edge, the missing refusal.

## Out of Scope

- Chunked uploads to keep 200 MB behind a proxy.
- A grandfather clause for listings already above the limit.
- A size bar for entity cards or dictionaries outside the World Editor.
- Browser storage quota warnings for large local worlds.
- The avatar upload mismatch between client and server limits.
- Changing the per-image caps, the downscale prompt, or the oversized-image rule.
- Correcting the server docs that describe a cloudflared tunnel.

## Further Notes

Published world sizes on 2026-09-10, from 669 files on the server: median 2.0 MiB, 90th percentile 23.7 MiB, 99th percentile 68.9 MiB, one file above 100 MiB at 163.3 MiB.

Cloudflare's request body limit, from its 413 support page: Free and Pro 100 MB, Business 200 MB, Enterprise self-serve to 5 GB. The API record is DNS-only today. Proxying it is a pending migration step, and the new limit makes that step free.

The ADR that the Test Bench shows computation and never model judgment holds: the size is a deterministic byte count.
