# Action Image Attachments

Status: ready-for-agent
Spec session: action-image-attachments — spec

The player can attach up to four images to a player action. The images go to the AI as image content parts, together with the action text. The prompts do not change. The player decides what to tell the AI about the images. Designed in a grilling session on 2026-09-30 (rulings Q1–Q19).

## Problem Statement

A player can send only text with an action. Many models can now read images. A player who wants to show the AI something (a sketch of a room, a reference for an entity's look, a screenshot of a map) must describe it in words. Formamorph cannot send an image to any model today. Every message is plain text.

## Solution

A new setting, **Image Attachments**, turns the feature on. It is off by default. When it is on:

- The action box gets an attach button. It also accepts images by paste and by drag and drop.
- An action carries up to four images. Each image is downscaled and re-encoded when the player attaches it.
- Small thumbnails show under the action in the chat. A click opens the image viewer.
- Each prompt in a prompt preset gets an **Include Attachments** toggle. Only the passes with the toggle on receive the images. Narration has it on by default. The other prompts have it off.
- The images go out on their own turn only. Later turns send the action text alone, with no marker.
- The images are saved with the playthrough.

When the setting is off, all attachment UI is hidden and no images go to the AI.

If the bundled local engine runs a pass that has images, the pass drops them and runs on text. A warning shows once per session. If a remote model rejects images, its error shows in the normal error toast.

## User Stories

1. As a player, I want to attach an image to my action, so that the AI can see what I mean.
2. As a player, I want to paste an image from my clipboard into the action box, so that I can send a screenshot fast.
3. As a player, I want to drag an image file onto the action box, so that I can attach it without a file dialog.
4. As a player, I want to pick an image with a file picker, so that attaching works on desktop and Android.
5. As a player, I want to attach up to four images to one action, so that I can show a comparison.
6. As a player, I want the app to refuse a fifth image with a clear message, so that I know the limit.
7. As a player, I want to see thumbnails of pending images before I send, so that I can check them.
8. As a player, I want to remove a pending image before I send, so that I can fix a mistake.
9. As a player, I want thumbnails under my past actions in the chat, so that I can see what I sent.
10. As a player, I want to click a thumbnail to see the full image, so that I can check its detail.
11. As a player, I want large photos to be downscaled when I attach them, so that my saves and requests stay small.
12. As a player, I want to write my own words about an image, so that I control how the AI uses it.
13. As a player, I want the AI to receive no hidden text about my images, so that my action text is the only instruction.
14. As a player, I want the images sent only on the turn I attach them, so that later turns do not cost more.
15. As a player, I want a regenerated turn to send its images again, so that the new narration sees the same input.
16. As a player, I want an edited action to keep its images, so that I can fix a typo without attaching again.
17. As a player, I want to remove an image when I edit an action, so that I can take back an image I sent.
18. As a player, I want my images to be in my save, so that a loaded save shows my thumbnails.
19. As a player, I want a save I move to another machine to keep its images, so that the save is self-contained.
20. As a player, I want the feature off by default, so that my action box does not change unless I ask.
21. As a player, I want one setting to turn the feature on, so that I can find it in one place.
22. As a player with the setting off, I want no attachment UI anywhere, so that the screens stay simple.
23. As a player with the setting off, I want a loaded save's thumbnails to still show, so that my history stays complete.
24. As a player with the setting off, I want no images to go to the AI, so that the setting is a real off switch.
25. As a player on the bundled local engine, I want my turn to run on text when it can't take images, so that the game does not stop.
26. As a player on the bundled local engine, I want one warning per session that the images were ignored, so that I know without being nagged.
27. As a player on a text-only remote model, I want the server's error in the normal error toast, so that I can see why the turn failed.
28. As a player, I want to use View Details on that error, so that I can see the server's exact message.
29. As a preset author, I want to choose which prompts receive attachments, so that I control the cost per turn.
30. As a preset author, I want Narration to receive attachments by default, so that the common case works with no setup.
31. As a preset author, I want the Include Attachments toggle to travel in an exported preset, so that my vision preset works for others.
32. As a player importing an older preset, I want missing toggles to take their defaults, so that the import works.
33. As a player, I want slash commands to ignore attachments, so that a command does not send images anywhere.
34. As a player, I want the opening turn to stay as it is, so that a new game starts the same way.
35. As a player on Android, I want the attach button to open the system image picker, so that I can attach photos from my device.
36. As a player, I want a clear message when a file is not an image, so that I know why it was not attached.
37. As a player, I want pending images to clear after I send, so that the next action starts empty.

## Implementation Decisions

**Attachment model and storage**
- An attachment is an image record: an id, the MIME type, and the image data as a data URL. The data is the downscaled JPEG.
- Attachments live in a side map on the playthrough, keyed by turn id. This follows the scene images pattern. Chat messages stay text-only, so the history, budgeting, the Request Anatomy view, the prompt diff, and the parity recorder do not change.
- A new attachment store module owns: adding images to a pending set, the four-image cap, the image type check, downscaling, reading the images of a turn, removing an image, and save serialize/restore.
- Downscale on attach: the long side is at most 1568 px, with no upscale. The image is re-encoded to JPEG, on a white background, keeping the first frame of an animation. Q7 first ruled WebP; it reopened when LM Studio refused WebP image parts while PNG, JPEG and GIF passed its check.

**Save shape (⚠️ export-shape change, additive)**
- The save envelope gets an optional attachment map keyed by turn id. It is always written when it has entries. A save without it loads with no attachments.
- The feature is unreleased, so there is no migration.

**Prompt preset shape (⚠️ export-shape change, additive)**
- Each prompt entry in a preset gets an optional Include Attachments flag. A missing flag takes its default: on for Narration, off for every other prompt.
- The flag travels in the preset share code and the preset JSON.

**Settings**
- A new boolean setting, Image Attachments, defaults to off. It lives in a new Attachments section on the Output tab. It shows in Simple and Advanced mode. Narration defaults on, so Simple players get a working feature without the Prompts tab.
- The existing Output tab dev route covers the setting. The thumbnails use `gameViewer` with `attach=sample`. That route turns the setting on without saving it, and stages two pending images plus two on the latest turn.
- The turn-id map is pruned against history whenever no turn runs, so a failed turn leaves no orphan. "No turn runs" means the waiting flag is clear and the turn's abort controller is gone. A regenerate starts inside an effect, so its user message commits before the waiting flag sets. A regenerate reads the old turn's images before the rewind and holds them with the pending turn, so the prune can't reach them. It stores them under the new turn id when the turn starts. A failed regenerate loses its images with the rest of the turn, the same as a failed send.
- Only prompts whose turn pass sends the player action can carry images: Narration, Planning, Director, Character, Storyboard, Choices, Stat Updates, Location Change, Time Passed and Summary. The other prompts show no Include Attachments toggle, and their flags are dropped on import.
- Off hides the attach button, turns off paste and drop handling, and hides the Include Attachments toggles on the Prompts tab. The stored flags stay unchanged.
- Off also means no image goes to the AI, including when a turn with attachments is regenerated.

**Turn Pipeline**
- The Turn Plan records, per pass, whether the pass includes attachments. The value comes from the setting and the preset flag.
- The images for the turn enter the run as plain input next to the action text.
- When the final request of a pass that includes attachments is built, its last user message becomes content parts: the text part first, then one image part per attachment, in attach order. No other message changes.
- A new wire-only user message type carries the content parts. The history message type stays text-only.
- Slash commands and the opening turn never carry attachments.
- The requests built by hand outside the pipeline (the choices and stat re-rolls, the idle summary drainers) never carry attachments.

**Regenerate and edit**
- A regenerate sends the turn's stored attachments again, under the same rules.
- Editing an action keeps its attachments. The edit UI can remove an attachment. A removed attachment leaves the side map. Removal is staged and applies on Save.
- The edit UI shows the thumbnails with remove buttons even when the setting is off (Q20). This is the one exception to "off hides all attachment UI": removing an image sends nothing.
- With the setting off, a regenerate sends no images but still stores the old turn's images under the new turn id. Off stops sending. It never deletes the player's images.

**Local engine**
- The engine's message split turns a content-parts message into its text and drops the image parts. The engine then reports that it dropped images.
- The app shows a warning toast the first time this happens in a session.

**Remote errors**
- There is no endpoint capability flag. A server that rejects image parts returns its error, and the normal error toast shows it.

**UI**
- The attach button, paste handling, and drop handling all feed one pending set on the action box. Pending images show as removable thumbnails above or beside the input.
- Past actions show thumbnails under the action line. A click opens the existing image viewer.
- A non-image file or a fifth image is refused with a toast.
- A paste that carries text inserts only the text, even when the clipboard also holds an image (Q21). A copy from a spreadsheet carries a rendered image of its cells, and attaching it is never wanted.
- Every send clears the pending attachments, also with the setting off (Q22). A regenerate leaves the box alone.
- On preset import, the Include Attachments flags arrive with the preset's tuning, under the same checkbox (Q23).
- The Include Attachments toggle sits on each prompt in the Prompts tab.

## Testing Decisions

A good test drives a public seam and checks what the seam puts out. It never mirrors the implementation. Each guard is proved by putting its bug back and watching the test fail.

- **Turn Pipeline request adapter** (existing seam, ADR 0001). Runner tests pass a fake adapter and read the recorded requests. They check that:
  - only the passes with the flag on carry image parts;
  - the text part comes first, then the images in order;
  - earlier history messages stay strings;
  - with the setting off, no pass carries parts.
  Prior art: the turn runner and turn passes tests.
- **Attachment store module** (the one new seam). Tests cover the four-image cap, refusing a non-image, downscaling to a long side of at most 1568 with no upscale, output as JPEG, removal, and a save round trip. Prior art: the scene images tests.
- **Preset share** (existing). A preset with the flag set round-trips through the share code and the JSON. An older preset with no flag gets the defaults. Prior art: the prompt presets tests.
- **Local engine message split** (existing). A content-parts message keeps its text, drops its images, and reports the drop. Prior art: the llm engine tests.
- **GamePanels harness** (existing). Tests cover attach by picker, paste and drop, pending thumbnails and removal, the refusal toasts, and thumbnails on past actions. With the setting off, no attachment UI renders. Prior art: the GamePanels chat actions tests.

## Out of Scope

- Files that are not images.
- Any prompt change, including a marker on past turns that had images.
- Sending past images again on later turns, and pinning images to keep them in context.
- Token budgeting for images.
- An endpoint capability flag, and a retry without images.
- Image input on the bundled local engine. node-llama-cpp 3.22.1 has no image input, and upstream issue #88 is still open.
- Attachments on the opening turn, on slash commands, and on the requests built by hand outside the Turn Pipeline.
- A user setting for the downscale size.

## Further Notes

- Checked live on 2026-09-30: the latest node-llama-cpp is 3.22.1, its user message type is text-only, and issue #88 ("pass an image as part of the evaluation") is open with the `roadmap` label. When upstream ships image input, the local engine drop can become a real image path.
- Scene images were moved out of chat messages because parsing a message with an inline image stalled the narration reveal. Attachments stay out of messages for the same reason.
