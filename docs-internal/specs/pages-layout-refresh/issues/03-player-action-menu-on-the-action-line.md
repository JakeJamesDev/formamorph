# 03: Player-Action Menu on the Action Line

Status: ready-for-human
Base: 3ee13555
Blocked by: 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Model rationale: reuses Chat's existing builder and edit path; one new trigger and its tests.

## What to build

A right-click, or a touch long press, on the Pages action line opens the player-action menu: **Edit** and
**Copy Text**. The menu comes from the same player-action builder as the Chat action bubble. Edit uses the
existing player-action edit path: it rewrites the turn's user message and leaves the narration and the turn's
memory digest as they are.

The action line has its own menu trigger. A context-menu event on the line does not open the card's menu.
A right-click on selected text keeps the browser menu, as in Chat.

Shares the narration panel file with 04 and 05; run them one at a time.

## Acceptance criteria

- [x] Right-click on the action line lists exactly the player-action builder's actions
- [x] Edit opens the editor with the action text; save changes the user message and not the narration
- [x] Copy Text copies the action's markdown source
- [x] Edit is disabled while a turn generates
- [x] The card's narration menu does not open from the action line
- [x] The parity test also compares the player-action menu between Pages and Chat
- [x] Four gates green
