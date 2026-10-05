# 01: Bubble chrome and layout

Status: in-progress
Base: 004e7d8d
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

With the Mascot on and Chat Style on Auto, the help window opens as her speaking the newest answer from a speech bubble.

- Chat Style gains **Bubble**. Auto resolves to Bubble with the Mascot on and Full with it off. Bubble pinned with the Mascot off draws Minimal. The Chat Style row and the ⋮ menu list four values.
- Full view: the bubble's bottom edge sits at the bottom of her head and the bubble grows up to the screen margin, then scrolls inside. The tail leaves the edge nearest her at her head's center. Under the bubble sits the strip: chevron slots at both ends (disabled, wired in ticket 02), **Sources** and **Take Me There**. The question pill and the ask input pin to the bottom of the group, level with her feet. A short answer leaves a gap between the strip and the question.
- Head view: one column, answer bubble, tail down, head pill, strip, question, input. The head sits at the pill's end nearest the screen edge. The pill is always visible.
- Crossing the screen's center mirrors the group with no transition. The bubble's resize grip sits on the corner facing the most open space. Her body is the drag handle; the pill keeps its grip.
- The Thinking fold opens inside the bubble under the answer; its toggle sits in the strip. **Sources** in the strip opens a popover listing the sections as links (Q22).
- Two grips: the bubble grip resizes the chat; a grip on the Mascot sets her Scale, feet and outer side fixed (Q18, Q19). The pill's drag handle is the vertical grip icon (Q20). The answer scrolls through the shared ScrollArea with the top fade (Q21).
- With no exchange, no bubble and no strip; she shows the Initial look with only the input.
- The Mascot Position row and its ⋮ menu entry render only under Minimal and Full. The mobile sheet and the Lookup reader keep today's behavior.
- The mock shows layout only. Bubble draws with the Minimal style's pieces, tokens, radii, shadows and Scrim; the answer bubble is the assistant bubble with a tail. Nothing new in the Design System.
- The layout is a pure function beside the existing window layout: her box, the viewport, head view and content height in; her rectangle, bubble, tail anchor, strip, question, input, grip corner and side out.

Spec: Q1, Q3, Q4, Q6, Q7, Q9, Q10, Q11, Q13 to Q22; Implementation → Chat Style, Window layout module, Window, Copy. The settled mock: `.scratch/bubble-chrome-mock.html`.

Recommended model rationale: a new chrome and a geometric layout variant that touches the resolver, the stored window and the window component; the mirror, tail and grip rules need careful reasoning.

## Acceptance criteria

- [ ] Chrome resolver tests: Auto with the Mascot on is bubble; Auto with it off is full; bubble pinned with the Mascot off is minimal.
- [ ] Layout tests: bubble bottom at her head's bottom; tail anchor at her head's center; the bubble caps at the screen margin with the strip under it; question and input level with her feet; mirror on crossing the center; grip on the corner away from the edges; head view stacks in the ruled order.
- [ ] Render tests through the Formaquestion harness: the newest answer shows in the bubble with Sources and Take Me There in the strip; dragging her body moves the window; the Mascot Position row is absent under Bubble and present under Minimal.
- [ ] Copy passes the copy sweep; the Chat Style hint names Bubble as the Auto style with the Mascot on.
- [ ] Changelog line under In Progress. The four gates are green.
