# 06: Local Engine Drops Images

Status: ready-for-human
Base: 84a8d2ed
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The bundled local engine (node-llama-cpp) has no image input. When a pass with image parts routes to it, the engine keeps the text, drops the images, and reports the drop. The turn runs normally. The app shows a warning toast the first time this happens in a session, and stays quiet after that until a reload.

## Acceptance criteria

- [ ] The engine's message split turns a content-parts message into its text, for both history messages and the final prompt.
- [ ] The engine reports that it dropped images, and the app shows one toast per session.
- [ ] A text-only request behaves exactly as today.
- [ ] Tests in the llm engine tests cover the split with parts (text kept, images dropped, drop reported) and a plain string message unchanged.
