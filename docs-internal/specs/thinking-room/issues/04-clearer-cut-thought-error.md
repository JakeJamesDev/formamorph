# 04: Clearer Cut-Thought Error

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: copy and two Error Details lines, read from fields ticket 01 puts on the AI Request Spec.

## What to build

When a reply ends on the token limit before any answer or call, the error says the model used all its thinking room before it wrote an answer. Error Details add the Thinking Room and its strength beside `max_tokens`, where the call had a room. Copy follows STE and goes through the copy sweep. The error still travels through the call's one sink (ADR 0012).

Spec: Q4; stories 12, 13.

## Acceptance criteria

- [ ] The cut-thought message names the thinking room as the cause
- [ ] Error Details list the room and strength for a call that had one, and omit them for a call that had none
- [ ] No retry is added
- [ ] Four gates green
