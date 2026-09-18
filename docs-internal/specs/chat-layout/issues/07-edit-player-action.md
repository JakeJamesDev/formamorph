# 07: Edit Player Action

Status: ready-for-agent
Blocked by: 06
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Spec: `docs-internal/specs/chat-layout/spec.md`

## What to build

The action bubble's menu gets **Edit**. The player can fix a line they sent. This is a new capability: today
only the narration can be edited. The edit rewrites the user message of that turn in the history, so the AI
reads the edited line on later turns. The save shape does not change.

## Acceptance criteria

- [ ] Edit opens the existing edit modal with the action text of that turn.
- [ ] Save rewrites that turn's user message in the history and nothing else. The bubble shows the new text.
- [ ] The first turn, which has no action, offers no Edit.
- [ ] Edit is disabled while a reply streams.
- [ ] The save envelope keeps its shape. State this check in the hand-over.
- [ ] A harness test covers the write: the right message changes, and the turns on each side do not.
- [ ] The guard is proven once by reinstating the bug. Four gates green.
