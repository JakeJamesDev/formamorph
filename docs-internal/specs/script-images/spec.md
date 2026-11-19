# Spec: Script Images

Status: ready-for-agent
Spec session: script-images — spec

## Problem Statement

A world's images live on the Media List, and a script can already set which image an entity, location or item shows. But a script cannot put an image into the story itself. An author who wants a picture at a story beat has only these options: swap an entity's portrait, or write a `player.tell` line that describes the picture. Neither one puts the picture where the reader is looking: in the narration, next to the words it illustrates.

## Solution

Scripts get `player.show(name, opts)`. It puts a Media List image into the narration panel, and the script's Timing decides where:

- **Before the AI**: above the turn's narration, shown at turn start.
- **After the AI**: below the narration, in call order with the turn's tells.
- **During AI Output**: after the sentence that just completed. It can float left or right with the text wrapping around it.

Options set the size, and in During AI Output the wrap. The image is saved with the turn, so it is still there after a reload. The AI never sees it. A click opens it full size.

## Rulings

- **Q1 One verb.** Every timing uses `player.show(name, opts)`. This reopens Q14 of the script-prompts work for one call only (see Q5).
- **Q2 AI never sees it.** A shown image is display only, like `player.tell`. The AI's context does not change.
- **Q3 During AI Output options.** `wrap` is `block` (full width, breaks the text), `left` or `right` (floats, and text wraps around it). `size` is `small`, `medium` or `large`. Floats become `block` at mobile width.
- **Q4 Stopped reply.** A reply the player stops drops its During AI Output images, as it drops every During AI Output write.
- **Q5 Only `show` in During AI Output.** `player.show` works there. `tell`, `toast`, `confirm`, `ask` and `input` still throw "can't run in During AI Output".
- **Q6 Storage.** An image is an entry in the save's existing per-turn `scriptTells` list, next to the text tells. The entry holds the media id, size, wrap and, for During AI Output, the sentence index. One list keeps the call order of tells and images.
- **Q7 Re-roll Stats.** Images follow the tell rule. Re-roll drops the Start, Before and After images, and the replayed scripts add them again. An abandoned re-roll restores the old ones. During AI Output images stay with the kept narration.
- **Q8 Other script sources.** Item scripts and a world Tool's On Call script place an image by when they run. A run before the narration starts places it above. A run after the reply ends, or between turns, places it below the latest turn. Item scripts run at reply end, so their images go below.
- **Q9 Before and After options.** Before and After images take `size` only and are always `block`. A `wrap` in those timings is ignored.
- **Q10 Click.** A click opens the image full size in the app's existing image viewer.
- **Q11 Before timing.** A Before image shows at turn start, while the reply loads.
- **Q12 Defaults and errors.** `player.show("Name")` gives a medium block. A name with no Media List image, or a sound's name, stops the script with the error the image setter gives, naming the name.
- **Q13 Layouts.** Images show in Pages and Chat layouts under the same rules. In Chat, floats sit inside the bubble.
- **Q14 Test Bench.** The Test Bench lists each `player.show` call as a log line with the name and options. It does not draw the image.
- **Q15 No cap.** There is no limit on images per turn.
- **Q16 Item-timed tells on load.** Restore drops tells from item scripts today. Ticket 04 fixes that with its item-script images, since both need item-timed entries restored. (Ticket 04.)
- **Q17 Text tells stay below.** Only images split by placement group. Before and Start text tells keep rendering below the narration. (Ticket 01.)
- **Q18 Where "above" sits.** In Pages, it sits inside the turn card, after the action line and reasoning, above the narration text. In Chat, it sits between the player's action bubble and the narration bubble, at the tell column width. After images sit where tells sit. (Ticket 01.)
- **Q19 One validation rule.** A bad `wrap` value fails the script in every timing, like a bad `size`, even where `wrap` is ignored. A non-object `opts` or a non-string name throws a TypeError that names `player.show`. Unknown `opts` keys are ignored. (Ticket 01.)
- **Q20 Stored wrap.** Before and After entries always store `wrap: "block"`. (Ticket 01.)
- **Q21 Size proposal.** Widths are centered percentages of the narration column: small 33%, medium 60%, large 100%. Height is capped at 70vh. This is the proposal for the frames, and it needs the user's approval. (Ticket 01.)
- **Q22 Test Bench line.** `Show: Name (medium, block)`, with the wrap the call gave, since the bench has no placement. (Ticket 01.)
- **Q23 Switch timing.** A When a Trait Switches show goes in the below group and is not re-rolled, like switch tells. (Ticket 01.)
- **Q24 Retract.** When the reply retracts mid-stream, the images recorded before the retract drop, like the run's writes. (Ticket 02.)
- **Q25 Script error.** A During AI Output script that calls `player.show` and then throws keeps its image, as a show or tell does in other timings. Its writes still drop. (Ticket 02.)
- **Q26 Open quote.** An anchor sentence that ends inside an open quote holds its image until the quote ends, so dialogue never splits. (Ticket 02, user ruling.)
- **Q27 Index drift.** On reload, the saved narration is split again with the stream's splitter. A rewrite that changes the sentence count can shift later anchors. That is accepted. An anchor past the last sentence renders after the last sentence. (Ticket 02.)
- **Q28 Crawl reveal.** With Fade-in Narration off, an inline image appears when the crawl starts the next sentence. On the last sentence, it appears when the reveal ends. (Ticket 02.)
- **Q29 Editor in During AI Output.** `player` is a known global there with `show` as its only member. `player.` completes to `show` only, the other calls are flagged, and the player card says that only `show` runs in this timing. (Ticket 02.)

## User Stories

1. As an author, I want to call `player.show("Name")` from a script, so that a Media List image appears in the story.
2. As an author, I want a Before the AI image to appear above the turn's narration, so that a scene opens on its picture.
3. As an author, I want an After the AI image to appear below the narration, so that a picture can close the scene.
4. As an author, I want After images and `player.tell` lines to keep the order I called them in, so that a caption line can follow its picture.
5. As an author, I want a During AI Output image to appear right after the sentence that triggered it, so that the picture lands on the words it illustrates.
6. As an author, I want to float a During AI Output image left or right with the text wrapping around it, so that the narration reads like an illustrated page.
7. As an author, I want a `block` wrap that breaks the text, so that a large picture can stand on its own line.
8. As an author, I want to pick small, medium or large, so that a small icon and a full scene illustration both look right.
9. As an author, I want `player.show("Name")` with no options to give a sensible default, so that the simple case needs no options.
10. As an author, I want a misspelled image name to stop the script with an error that names it, so that I find the mistake in testing and not in play.
11. As an author, I want a sound's name passed to `player.show` to fail the same way, so that a wrong pick is never silent.
12. As an author, I want `player.show` to work in During AI Output while `confirm`, `ask` and `input` still throw there, so that a sentence never waits on a dialog.
13. As an author, I want the editor to accept `player.show` in a During AI Output script and still underline the other `player` calls there, so that the editor matches what runs.
14. As an author, I want images from an item script to appear below the turn, so that "you picked up the amulet" can show the amulet.
15. As an author, I want images from a world Tool's On Call script to follow when it ran, so that a Tool's picture lands next to the narration it belongs to.
16. As an author, I want the Test Bench to log each `player.show` call with its name and options, so that I can check my script without playing.
17. As an author, I want the Scripts Reference to document `player.show` and its options per timing, so that I can learn it without reading code.
18. As an author, I want images to cost nothing in the AI context, so that pictures never push story out of the prompt.
19. As a player, I want shown images to appear in the narration as the story unfolds, so that the picture arrives with its words and not before.
20. As a player, I want a Before image to show while the reply loads, so that I have something to look at while I wait.
21. As a player, I want to click an image to see it full size, so that I can look at the detail.
22. As a player, I want shown images to still be there after I reload a save, so that the story looks the same when I come back.
23. As a player, I want images to appear in both Pages and Chat layouts, so that my layout choice does not hide them.
24. As a mobile player, I want floating images to become full-width blocks, so that text does not squeeze into a sliver beside a picture.
25. As a player, I want a reply I stop to leave no stray images behind, so that the turn shows only what I kept.
26. As a player, I want Regenerate to replace the turn's images with the new run's images, so that pictures match the new narration.
27. As a player, I want Re-roll Stats to keep the narration's During images and refresh the Before and After ones, so that pictures follow the rerun scripts.
28. As a player, I want an image the author later deleted from the world to simply not show, so that an old save still loads cleanly.
29. As a player, I want the read-aloud voice to skip images, so that TTS reads only the story.

## Implementation Decisions

- **Script surface.** `player.show(name, opts?)` joins the `player` object in every timing. In During AI Output, the `player` stub gains a working `show`. Every other call there still throws the existing message. `show` returns nothing and never waits.
- **Options shape.** `opts` is `{ size?: 'small' | 'medium' | 'large', wrap?: 'block' | 'left' | 'right' }`. The defaults are `medium` and `block`. Outside During AI Output, `wrap` is ignored. A value outside the enum fails the script with an error that names the bad value.
- **Name resolution.** `show` resolves the name through the same name-to-id map the image setter uses. The first name wins, and only `kind: 'image'` matches. A miss fails with the image setter's error. The call records the media id, never the name, so a Media List rename does not break a saved turn.
- **During AI Output anchor.** The call records the run's `narration.index`. The image renders after that sentence.
- **Host channel.** The executor reports a show the way it reports a tell, through the script prompt host. The host records it on the running turn's `scriptTells` entry. The executor does not need to know the turn.
- **Save shape (export-shape change).** A `scriptTells` entry becomes a union. The text form keeps `{ text, timing }`. The image form adds `{ image: <media id>, size, wrap, sentence?: number, timing }`. The `scriptTells` field shipped in 3.7.0. This is an additive change to a shipped field and needs the export-shape reminder.
- **Restore and prune.** Restore accepts image entries next to text entries, under the same timing filter. Prune by turn id stays the same. A stopped reply discards its During AI Output entries before they are recorded.
- **Re-roll.** Image entries use the existing re-rolled-timings rule. Start, Before and After entries are dropped and replayed, and During AI Output entries stay.
- **Placement.** The turn's entries split into three groups: above (Before, Start, and pre-narration Tool or item runs), inline (During AI Output, keyed by sentence index), and below (everything else, in call order with text tells).
- **Narration render.** The narration renders as text segments cut at the anchored sentence boundaries, with each image between its segments. Images are React nodes, not markdown injected into Streamdown. An inline image appears when the sentence reveal releases its anchor sentence.
- **Floats.** `left` and `right` float inside the narration column (and inside the Chat bubble), and later segments wrap around them. Below the mobile breakpoint every float renders as `block`. Sizes map to width tokens from the Design System. Picking those tokens needs the user's approval as a new visual pattern.
- **Missing media.** An entry whose media id is no longer on the Media List renders nothing.
- **Click.** The image opens in the existing full-size image viewer.
- **TTS.** TTS reads only the narration text, so images never reach it.
- **Test Bench.** The bench's script prompt host logs `show` as a line with the name and options.
- **Editor analysis.** Script analysis treats `player.show` as valid in During AI Output, and keeps the other `player` members as errors there. The quick reference and autocomplete list `show`.
- **Docs.** The Scripts Reference documents `player.show`, its options, and placement per timing.

## Testing Decisions

- **The bar.** Tests check what an author or player sees: what a script call records, what the save restores, and where the image lands in the rendered narration. They never assert internal call order or private helpers.
- **Seam 1: the executor.** `executeStatCode` with a prompt host. It covers `show` in each timing, the During AI Output split (where `show` records and `tell` throws), the recorded media id and sentence index, the defaults, ignored `wrap` outside During AI Output, and the errors for a bad name, a sound name and a bad option. Prior art: `statCodeExecutor.prompts.test.ts`.
- **Seam 2: the tells module.** Restore with mixed text and image entries, prune by turn id, the re-roll drop and restore, and dropping malformed image entries. Prior art: `scriptTells.test.ts`.
- **Seam 3: the narration render.** A turn plus its tell list renders Before images above, inline images after their anchor sentence, and After images below in call order with tells. It also covers floats becoming blocks at mobile width, a missing media id rendering nothing, and both Pages and Chat layouts. Prior art: `GamePanels.chatLayout.test.tsx`, `ScriptPromptLine.test.tsx`.
- **Guards must bite.** Each placement test fails when its anchor rule is broken: a Before image rendered below, or an inline image rendered at the end.

## Out of Scope

- The AI learning that an image showed, alt text, or captions the AI reads.
- `tell` or `toast` in During AI Output.
- Wrap options for Before and After images.
- A per-turn cap on images.
- Drawing images in the Test Bench.
- Narration edit or swipe. Neither exists today, so no anchor drift rule is needed.
- Sounds or music through `player.show`.

## Further Notes

- **Design approval.** The float and size styling is a new visual pattern. It needs the user's approval and a Design System showcase entry before adoption.
