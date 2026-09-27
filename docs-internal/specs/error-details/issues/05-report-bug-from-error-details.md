# 05: Report Bug from Error Details

Status: ready-for-human
Base: b88ff1cc
Blocked by: 01 — Details field and headline
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A signed-in player presses **Report Bug** in Error Details and lands in the bug report with the title and description already filled in. The title is the toast's message. The description is the details without the diagnostics block, because the bug report attaches its own. The player adds what they were doing and sends.

One bug report mounts beside the Error Details host, next to the toast container, so the main menu, the World Editor and play all share it. It opens through the same store pattern Error Details uses. The existing mounts in play and the feedback hub stay for their own buttons.

The filled report wins over any unsent draft: the old draft is dropped and the filled report becomes the saved draft until sent or discarded. Details longer than the body limit are cut, with a closing line that says Copy has the full text. When the community flag is off, Error Details shows Copy only.

This ticket covers the signed-in path. Signed-out players are ticket 06.

Recommended model rationale: cross-view mounting, draft semantics and a new store touch three views at once; the failure modes are subtle.

## Acceptance criteria

- [ ] The bug report accepts optional initial title and body; opened from Error Details, both fields are filled
- [ ] The description omits the diagnostics block, and the sent report carries the block once
- [ ] With an unsent draft saved, opening from Error Details replaces it; reopening the report later shows the filled text, not the old draft
- [ ] Details longer than the body limit are cut and end with the note about Copy
- [ ] Report Bug works from the main menu, the World Editor and play
- [ ] With the community flag off, Report Bug is absent and Copy remains
- [ ] Mutation checks: keeping the old draft, dropping the note and showing Report Bug with the flag off each fail a test
- [ ] Four gates green; the dev-route drift guard still passes
