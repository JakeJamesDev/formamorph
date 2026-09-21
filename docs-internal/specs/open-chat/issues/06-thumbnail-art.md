# 06: Thumbnail Art

Status: ready-for-human
Blocked by: 01
Recommended model: N/A — the user supplies the art
Reasoning effort: N/A

## What to build

The Open Chat tile shows a thumbnail beside the other default worlds. The user supplies the image. Set it through the World Editor, then export the world over the bundled file, or hand the image to a session to embed.

## Acceptance criteria

- [x] The bundled world carries the thumbnail
- [ ] The tile renders it at the shared thumbnail aspect, in both themes
- [x] The content test still passes

## Comments

**2026-09-21.** The user supplied a 1368x768 PNG. It is embedded as WebP at 1024x575 (58 KB), inside the app's thumbnail budget of 1024 px and 500 KB. The source is 16:9, which is the landscape frame, so nothing crops. The live tile check is open: the preview pane never mounted the app in this session.
