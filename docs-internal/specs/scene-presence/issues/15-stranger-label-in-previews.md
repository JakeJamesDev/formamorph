# 15: Show the Stranger Label in Prompt Previews

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Ticket 14 gives every roster in play an unmet stranger's label beside the true name. The Test Bench's opening preview and the AI Context preview build their own scene from the authored world, and that scene carries no stranger labels. So a preview lists a stranger by true name only, while turn one in play shows the label too. Previews match play (Q88): at the opening, each entity with a Stranger Name that the start rule leaves unmet carries its Stranger Name as its label.

## Acceptance criteria

- [ ] The authored scene carries a stranger label for each entity with a Stranger Name that the start-met rule leaves unmet, for the persona the preview holds.
- [ ] The Test Bench's opening preview and the AI Context preview render the same roster text as turn one in play for the same world and persona.
- [ ] A met entity, or one without a Stranger Name, renders as today.
- [ ] Each test fails when its old behavior is put back.
