# 06: Bubble Context Menus

Status: ready-for-human
Base: aa03a3ef
Blocked by: 04, 05
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/chat-layout/spec.md`

## What to build

A right-click, or a long press on touch, on a Chat bubble opens a menu with that bubble's actions, so the
player does not scroll to the bottom of a long turn. The narration menu renders the same action list as the
icon row. The choices block offers Re-generate Choices. The action bubble offers Copy Text.

## Acceptance criteria

- [ ] The menus use the app's shared context menu primitives, unchanged.
- [ ] The menus follow the context menu grammar: action rows carry icons; sections are generate, content, destructive; a separator divides sections; Rewind to Here is last and uses the destructive color.
- [ ] The narration menu and the icon row come from one list. A harness test asserts that they list the same actions, with Write Scene Tags and Re-generate TTS as normal menu rows.
- [ ] The More icon on the row opens this same menu.
- [ ] A right-click on a non-collapsed selection inside the bubble opens the browser menu, not ours.
- [ ] A live turn has no menu.
- [ ] The action bubble has a menu with Copy Text and no icon row. Ticket 07 adds Edit.
- [ ] Verified in the preview with static frames. Four gates green.

## Comments

- **Long press on a choice (2026-09-18).** A touch long press on a choice keeps the Pages append gesture
  (spec ruling on choice click) and does not open the choices menu. A right-click on the choices block, or a
  long press on its Re-generate Choices icon, opens the menu. The append fires at 500 ms and the menu at
  700 ms, so without this guard one press did both.
- **Verification (2026-09-18).** The hidden preview pane reported a 0×0 viewport and a stale frame, so the
  real-click checks ran in a throwaway Playwright spec: right-click, More, action bubble, choices, a past
  turn (Rewind to Here last, destructive red, two separators), and a drag selection that leaves the browser
  menu. All passed; the spec is not kept, since the e2e suite covers scroll mechanics.
- **Review (2026-09-18).** Folded in: the selection check scopes to the right-clicked node, the action bubble
  is live only while a reply is in flight, one shared icon button for the row and the choices, and a
  clipboard-missing toast. Kept: the generate/content separator, which this ticket's grammar line requires.
  Open, device-only: a touch long press to select text in a bubble opens the bubble menu, because Radix's
  long-press timer never fires `contextmenu`; the selection guard cannot see it. Needs a phone check.
