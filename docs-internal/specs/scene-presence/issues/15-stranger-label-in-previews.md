# 15: Show the Stranger Label in Prompt Previews

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Ticket 14 gives every roster in play an unmet stranger's label beside the true name. The Test Bench's opening preview and the AI Context preview build their own scene from the authored world, and that scene carries no stranger labels. So a preview lists a stranger by true name only, while turn one in play shows the label too. Previews match play (Q88): at the opening, each entity with a Stranger Name that the start rule leaves unmet carries its Stranger Name as its label.

## Acceptance criteria

- [x] The authored scene carries a stranger label for each entity with a Stranger Name that the start-met rule leaves unmet, for the persona the preview holds. (`authoredScene.test.ts`, "stranger labels")
- [ ] The Test Bench's opening preview and the AI Context preview render the same roster text as turn one in play for the same world and persona. (Opening preview: `opening.test.ts` "stranger label on turn one". AI Context shares the scene but has no test of its own.)
- [x] A met entity, or one without a Stranger Name, renders as today. (both test files, met and no-name cases)
- [x] Each test fails when its old behavior is put back. (Removed the scene's labels: 4 tests red. Removed the opening's persona: the met-entity test red.)

## Landed

**Not verified**
- No byte-for-byte comparison of the preview roster against `liveChipScene` output for the same world. Both read `strangersInPlay`, but no test joins them.
- No test builds the AI Context itself with a stranger. It passes no persona (None), so every Stranger Name entity the start rule leaves unmet carries its label.

**For you**
- Open the Test Bench opening preview on a world with a Stranger Name entity, and check the roster shows the label beside the true name. Switch the persona to one who knows the entity, and check the label goes.
