# 14: Mascot tab full-width rows

Status: done
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Mascot tab's controls column stops spending a quarter of its width on labels.

- The Base Image and the layer list drop the label column and take the full column width, each under its own heading in the section style the tab already uses. Layer rows get the room back for their names, overlays and the remove button.
- The switch, Voice, picks and card buttons keep their rows.
- Frames at 1600×900 and 1366×768 in both themes go to the user in the ticket's Answer.

Spec: Q51; Implementation → Mascot tab.

Recommended model rationale: a layout change on one tab with existing section patterns.

## Acceptance criteria

- [x] Layer rows at 1600×900 show full names at the default rig's longest name without truncation.
- [x] Component tests still find the Base Image control and every layer row by role and name.
- [x] Frames in the Answer.
- [ ] The four gates are green.

## Answer

The Base Image and the layer list now sit in their own Sections (**Base Image**, **Layers**), each with its hint under the heading and a full-width body. The switch, Voice, picks and card buttons keep their label rows. The picks and card buttons stay under a **Rig** Section.

- Measured in the browser at 1600×900 and 1366×768, both themes: "Unimpressed", the longest default layer name, is not clipped.
- At 1600×900 the controls column is 459px wide and each layer row 441px.
- Frames (1600×900 and 1366×768, dark and light) went to the user in the session chat.
