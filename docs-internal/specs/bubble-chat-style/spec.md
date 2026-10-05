# Spec: Bubble Chat Style

Status: ready-for-agent
Spec session: bubble-chat-style — spec

## Problem Statement

The Mascot stands next to a chat column. The column is a scrolling list of questions and answers, and she is a figure beside it. The two never read as one thing: she does not speak, she stands by while a chat happens. Putting her under the column (Mascot Position) did not fix that.

## Solution

A third Chat Style, **Bubble**, makes her the speaker. The answer sits in one speech bubble whose tail points at her head. One question-and-answer pair shows at a time; chevrons page through the conversation. The question shows in a read-only pill above the input, and the input is a fresh box every time. Sources and Take Me There sit in a strip under the bubble. Bubble is the default with the Mascot on. Minimal stays as a pinned style.

The mock that settled the layout: `.scratch/bubble-chrome-mock.html` (frames in `.scratch/shots/`).

## Rulings

| # | Ruling |
|---|---|
| Q1 | Bubble is a third Chat Style. Auto resolves to Bubble while the Mascot is on and to Full with it off. Minimal and Full stay as pinned styles. Bubble pinned with the Mascot off has no speaker and draws Minimal |
| Q2 | One exchange per page. Chevrons step through the conversation, newest last. A new question jumps to the newest page. The page's question shows in a read-only pill above the input; the input is empty on every page |
| Q3 | Full view. The bubble's bottom edge sits at the bottom of her head. The bubble grows up from there to the screen margin, then scrolls inside. Its tail leaves the edge nearest her at her head's center height. The strip (chevrons, Sources, Take Me There) sits under the bubble. The question pill and the input pin to the bottom of the group, level with her feet. A short answer leaves a gap between the strip and the question |
| Q4 | Head view. One column: answer bubble, tail pointing down, head pill, strip, question, input. The pill stays visible. The head sits at the pill's end nearest the screen edge |
| Q5 | The pill sits over her head inside her bounds. It shows when the window opens, fades after a short delay, and returns on hover or keyboard focus. On touch it stays visible. Reduced motion shows and hides it with no fade. Her body is the drag handle; the pill keeps its grip too. The delay is one tuning constant |
| Q6 | Crossing the screen's center line mirrors the whole group: bubble, tail, strip, question, input, grip. It snaps, no transition. Text inside stays left-aligned |
| Q7 | The resize grip sits on the bubble's corner that faces the most open screen space. Superseded by Q19: it resizes the chat, and a second grip on the Mascot sets her scale |
| Q8 | Each exchange keeps the face the AI set for its answer. Paging to an exchange shows that face. The newest page shows the live phase and face. While an answer streams and the player has paged back, the next chevron carries a mark |
| Q9 | Mascot Position (Beside, Below, Auto) applies to Minimal and Full only. Bubble ignores it, and its row and ⋮ menu entry are hidden under Bubble |
| Q10 | The mobile sheet is unchanged. Bubble on the sheet draws what Minimal draws there |
| Q11 | The Lookup reader keeps today's rule: beside the group on the wider free side, at the bubble's height |
| Q12 | Chevrons are always present and disabled at the ends, so the strip never shifts |
| Q13 | With no exchange, no bubble and no strip draw. She shows the Initial look with the input under her head height, in the same place the input holds later |
| Q14 | The Sources list and the Thinking fold open inside the bubble under the answer text. The strip holds their toggles, with Take Me There beside Sources as today |
| Q15 | The window's stored box under Bubble is her position only. Her size comes from Scale and the grip (Q7). The 60% default height and the Below cap do not apply |
| Q16 | The mock shows layout only, not chrome. Bubble draws with the Minimal style's pieces: the same pill, bubble, input and strip surfaces, tokens, radii and shadows, and the Scrim. Nothing new in the Design System |
| Q17 | Under Bubble with Scale on Auto she draws at a fixed share of the viewport height, one tuning constant starting at 60%, capped so the whole group fits inside the screen margins. The first grip drag writes a percent to the per-device Scale store, as the Mascot tab's slider does; after that the stored percent rules. Head view under Auto keeps today's head height (ticket 01) |
| Q18 | A grip drag keeps her feet and her outer side fixed, the corner opposite the grip, and she grows toward the open space. The group follows her (ticket 01) |
| Q19 | Two grips, in both views. The bubble's grip resizes the chat. A grip on the Mascot sets her Scale, with Q18's anchor. The Mascot grip fades with the pill (ticket 03). Replaces the single grip in Q7 |
| Q20 | The pill's drag handle is the vertical grip icon, to take less room |
| Q21 | Scrolling content uses the shared ScrollArea, never a native overflow scrollbar. A guard flags a native overflow scroller in components unless the file uses ScrollArea or carries a one-line allow comment naming the Design System exception (ticket 04) |
| Q22 | The Sources list opens as a popover from the strip's Sources button, each section a link, with the flagged answer's nearest sections there too. The bubble holds the answer and the Thinking fold only. Take Me There stays in the strip (ticket 01) |

## User Stories

1. As a player, I want her to speak the answer, so that the help feels like one character and not a chat beside a figure.
2. As a player, I want one answer at a time, so that I read the current reply without a scrolling log.
3. As a player, I want chevrons to step back through earlier answers, so that nothing I asked is lost.
4. As a player, I want to see the question each answer replies to, so that an old answer makes sense on its own.
5. As a player, I want a fresh input every time, so that I never edit an old question by mistake.
6. As a player, I want Sources and Take Me There under the answer, so that they stay with the reply they belong to.
7. As a player, I want a long answer to grow upward and then scroll, so that she and the input never move.
8. As a player, I want the tail to point at her head, so that it reads as speech.
9. As a player, I want the pill to stay out of the way until I hover, so that she is not covered by buttons.
10. As a player on a touch screen, I want the pill always visible, so that I can still move and close the window.
11. As a player, I want to drag her body to move the window, so that a hidden pill never traps the window.
12. As a player, I want the layout to mirror when I move her to the other side, so that the bubble always faces inward.
13. As a player, I want the grip on the open corner, so that resizing never drags over the screen edge.
14. As a player, I want her to show the face she had for an old answer when I page to it, so that the reply and her look agree.
15. As a player who pages back while an answer streams, I want a mark on the next chevron, so that I know a new answer is waiting.
16. As a player in head view, I want a single column, so that the window takes less room.
17. As a player, I want Bubble as the default with the Mascot on, so that the best style with her needs no setup.
18. As a player who prefers Minimal, I want to pin it, so that the old look stays available.
19. As a player with the Mascot off, I want Full as before, so that nothing changes without her.
20. As a player with reduced motion, I want no fade on the pill, so that the window respects my setting.
21. As a player on mobile, I want the sheet unchanged, so that small screens are not affected.
22. As a player, I want the Mascot Position row gone under Bubble, so that a setting that does nothing is not offered.
23. As a developer, I want the exchange list, retrieval and the answer renderer untouched, so that Bubble is a view over the same conversation.
24. As a developer, I want the layout as a pure function with tests, so that the tail, grip corner and mirror rule are checked without a browser.

## Implementation Decisions

### Chat Style

- `CHAT_STYLES` gains `bubble`. The chrome resolver maps Auto with the Mascot on to `bubble`, and `bubble` with the Mascot off to `minimal` (Q1). The window chrome type gains the value; both stored-size slots and every chrome switch learn it.
- The Chat Style row and the ⋮ menu list four values: Auto, Bubble, Minimal, Full. Copy for the hint changes to name Bubble as the Auto style with the Mascot on.
- The Mascot Position row and menu entry render only while the resolved chrome is Minimal or Full (Q9).

### Window layout module

- A Bubble variant in the pure layout. Inputs: her box (position and scale), the viewport, head view, the bubble's content height. Outputs: her rectangle, the bubble rectangle, the tail anchor and direction, the strip, question and input rectangles, the grip corner, and the side (Q3, Q4, Q6, Q7).
- The side is a pure function of her center against the viewport's center. The grip corner is the bubble corner farthest from the nearest screen edges.
- The bubble's height caps at the room from her head's bottom edge to the screen margin; past that the bubble scrolls (Q3). In head view the cap is the room above the pill.
- Her scale from the grip writes the same per-device Scale store the Mascot tab uses (Q7, Q15). Auto is a viewport share, one constant, capped so the group fits; a drag anchors her feet and outer side (Q17, Q18).

### Window

- A `BubbleChat` component beside `MinimalChat`: the pill, her piece, the bubble with the answer renderer, the strip, the question pill, and the ask input. It reads the same `HelpChat` and settings as the other chromes.
- A page index in the window: it follows the newest exchange on a new question and on Clear Conversation, and the chevrons move it (Q2). The index is view state, never stored.
- The face: `composeMascot` takes the paged exchange's face, or the live face and phase on the newest page (Q8). `HelpExchange.face` already holds the per-answer value; nothing new is stored.
- The pill fade: a visible state set on open and cleared by a timer, re-armed by hover and focus; touch devices and reduced motion skip the timer (Q5). The Mascot grip shares that state (Q19). Her piece takes the drag handlers (Q5); the pill's handle is the vertical grip icon (Q20).
- The answer bubble scrolls through the shared ScrollArea with the Minimal column's top fade (Q21).
- The Thinking fold renders inside the bubble under the answer; its toggle sits in the strip (Q14). The Sources list is a popover from the strip's Sources button (Q22).
- The mobile sheet keeps its chrome (Q10). The reader piece keeps its placement helper (Q11).

- Bubble reuses the Minimal chrome's floating pieces and classes; the answer bubble is the assistant bubble with a tail (Q16).

### Copy

- Labels in AP title case: **Bubble**. Chevron labels: **Previous Answer**, **Next Answer**. The question pill has an accessible name that says it is the asked question.

## Testing Decisions

A good test calls the public seam with real inputs and asserts the observable result. It never reads internal fields or mirrors the formula.

- **Chrome resolver (existing seam).** Auto with the Mascot on is bubble; Auto with it off is full; bubble pinned with the Mascot off is minimal. Prior art: the Chat Style tests.
- **Window layout module (existing seam).** Bubble bottom at her head's bottom; the tail's anchor at her head's center; the bubble caps at the screen margin and the strip stays under it; question and input level with her feet; mirror on crossing the center; the grip on the corner away from the edges; head view stacks in the ruled order. Prior art: the window layout tests.
- **BubbleChat (new seam, through the Formaquestion harness).** Three exchanges render the newest; the previous chevron shows the earlier answer and its question; the next chevron is disabled at the end; a new question jumps to the newest page; the face shown follows the paged exchange; the pill is visible on open and hidden after the delay (fake timers), visible again on hover; the Mascot Position row is absent under Bubble. Prior art: the Formaquestion mascot and settings tests.
- **Guards bite.** Reinstate once: drop the jump-to-newest on a new question and the paging test must go red.

## Out of Scope

- Any change to retrieval, prompts, the answer renderer, or the exchange store.
- A transition when the side mirrors or a page changes.
- The mobile sheet.
- Rig, mask or Mascot tab changes.
- Storing the page index across opens.

## Further Notes

- The pill fade delay, the Auto height share and the bubble caps are tuning values. One constant each, set from the live window after the build.
- Mascot Position stays built for Minimal and Full. Its spec is `docs-internal/specs/mascot-below/spec.md`.
