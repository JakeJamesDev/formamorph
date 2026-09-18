# 07: Edit Player Action

Status: ready-for-human
Base: e5ea363f
Blocked by: 06
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Spec: `docs-internal/specs/chat-layout/spec.md`

## What to build

The action bubble's menu gets **Edit**. The player can fix a line they sent. This is a new capability: today
only the narration can be edited. The edit rewrites the user message of that turn in the history, so the AI
reads the edited line on later turns. The save shape does not change.

## Acceptance criteria

- [x] Edit opens the existing edit modal with the action text of that turn.
- [x] Save rewrites that turn's user message in the history and nothing else. The bubble shows the new text.
- [x] The first turn, which has no action, offers no Edit.
- [x] Edit is disabled while a reply streams.
- [x] The save envelope keeps its shape. State this check in the hand-over.
- [x] A harness test covers the write: the right message changes, and the turns on each side do not.
- [x] The guard is proven once by reinstating the bug. Four gates green.

## Comments

- **Test route (user, 2026-09-18).** A Dialog opened from a Radix context-menu row hangs jsdom; the narration
  menu's Edit from ticket 06 hangs the same way. Real Chromium opens both. So the write is unit-tested at a
  pure seam (`rewriteTurnAction` in `src/lib/turnHistory.ts`), and `e2e/chat-edit-action.spec.ts` drives the
  menu, the modal, and the save in a real browser. jsdom keeps the first-turn and the streaming-disabled
  checks (`GamePanels.editAction.test.tsx`).
- **Guard proof.** Pointing the rewrite at the narration index fails 2 unit tests. Skipping the action branch
  in the save fails the e2e spec. Both pass again once restored.
- **Known side effect.** The previous turn marks its taken choice by matching the next user message. An
  edited action that was a choice's text no longer matches, so that choice stops showing as taken.
- **Follow-up, not done here.** `messagesPerPage = 2` is a local constant in GameplayContext and GameViewer,
  and GamePanels passes a literal `2`. One exported constant would replace all three.
- **Save envelope.** No shape change. The edit replaces the `content` string of one `{ role, content }` user
  message.
