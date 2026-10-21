# 14: Player Input

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a rename across the executor, the surface, the rewrite pass, the guide and the Design System entry, each a known site.

## What to build

`player.askText` becomes `player.input` (R8). The executor answers `player.input` with the typed-answer prompt `askText` gave; the old name no longer exists. The load-time rewrite pass turns `player.askText(` into `player.input(` in every script of a world, a World Tool and a user Tool, idempotent, and a script that declares its own `player` is left alone as the other rewrites leave it. The surface entry, its card, the Variable menu row, the Scripts guide, the Design System entry for the inline prompt line and the copy test move to the new name. The async-engine gate on `player.` is unchanged, and the During AI Output refusal names `player.input`.

Spec: R8, Q1.

## Acceptance criteria

- [ ] `player.input("Your name?")` opens the text prompt and resolves to the typed answer; `player.askText` is not defined
- [ ] A world whose script calls `player.askText(` loads with `player.input(`; loading it again changes nothing; a script that declares `const player = …` is untouched
- [ ] The During AI Output refusal reads "player.input can't run in During AI Output"
- [ ] No source, guide or Design System page names `askText`; a grep in the test proves it, the changelog excluded
- [ ] A changelog fragment with a 👤 lead, since `askText` shipped in 3.3.1
- [ ] Four gates green

## Blocked by

- None (can start immediately)
