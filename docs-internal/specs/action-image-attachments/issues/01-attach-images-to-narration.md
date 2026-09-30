# 01: Attach Images to Narration

Status: ready-for-human
Base: 622b9d4e
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The tracer bullet. It cuts one path through the setting, the attachment store, the action box, the Turn Pipeline, the wire, and the chat.

## What to build

A player turns on **Image Attachments** in a new Attachments section on the Output tab. It is off by default. The action box then shows an attach button that opens a file picker. The player attaches up to four images, sees them as removable pending thumbnails, and sends the action. The Narration pass receives the images as image content parts after the action text. The action shows thumbnails in the chat, and a click opens the existing image viewer. In this ticket, attachments last for the session only. Tickets 03 and 04 add per-prompt routing and saves.

## Acceptance criteria

- [x] The new setting is off by default. Off means no attach button and no image in any request.
- [x] A new attachment store module holds the pending set and the turn-id map. It refuses a non-image file and a fifth image with a toast. It downscales to a long side of at most 1568 px with no upscale, and re-encodes to WebP.
- [x] The Turn Plan marks the Narration pass as including attachments when the setting is on. No other pass includes them yet.
- [x] The final Narration request's last user message is content parts: text first, then one image part per attachment, in attach order. It uses a new wire-only message type. The history message type stays text-only, and earlier history messages stay strings.
- [x] Slash commands, the opening turn, and the hand-built requests outside the Turn Pipeline never carry attachments.
- [x] Pending attachments clear after a send.
- [x] Past actions show thumbnails, and a click opens the image viewer.
- [x] A model that rejects images produces the normal error toast with View Details. No new code path is needed; check it.
- [x] Tests: turn runner with a fake adapter (parts only on Narration, order, history stays strings, setting off sends none); the attachment store (cap, type check, downscale, WebP, removal); the GamePanels harness (attach by picker, pending thumbnails, removal, no UI when off).
- [x] The setting has a dev-route entry, and its copy follows the Writing Guide.
