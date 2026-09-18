# 06: Bubble Context Menus

Status: ready-for-agent
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
