# Spec: Mascot Below

Status: done
Status note: Closed 2026-10-04. Tickets 01–02 done. Last landing cad6ecf9. Closed without gates.
Spec session: mascot-below — spec

## Problem Statement

The Mascot always stands beside the help chat. On a tall chat that is fine. On a short chat she is a small figure wedged to one side, and the two read as separate objects. Players who keep the chat short want her under it, as one card: chat above, Mascot below.

The chat also opens at a fixed pixel height. On a small window it is most of the screen; on a large one it is a strip. Nothing ties the default to the window.

## Solution

**Mascot Position.** A new row in the General tab's Window section, after Chat Style, and the same choice in the pill's ⋮ menu: **Beside**, **Below**, or **Auto**. Beside is today's rule: she stands on the side with the wider free gap. Below puts her under the column, bottom-aligned with the screen margin, and caps how tall the chat can be dragged so she always fits. Auto reads the same cap: below while the chat is at or under it, beside above it. Auto is the default.

**Her size below.** With Scale on Auto she fills the room from the column's bottom edge to the screen margin, width from her aspect. A percent scale clamps to that room; the column never moves for her.

**Default height.** A fresh window opens at 60% of the window height instead of a fixed pixel count.

## Rulings

| # | Ruling |
|---|---|
| Q1 | Position is a three-value setting, Beside / Below / Auto, default Auto. Below caps the column's resize at a shared max height constant, 75% of the window height to start, tunable after the build. Auto compares against the same constant: below at or under it, beside above it. One constant, both rules read it |
| Q2 | Below with Scale on Auto, she fills the room from the column's bottom edge to the screen margin, width from her aspect. A taller chat means a smaller Mascot |
| Q3 | The rule compares column height to window height and snaps at the line. No hysteresis, no transition |
| Q4 | The default window height is 60% of the window height. Stored sizes need no handling; the window has not shipped |
| Q5 | Position lives in the General tab's Window section after Chat Style, as an OptionSwitcher Beside / Below / Auto, and in the pill's ⋮ menu beside Chat Style. Stored per device, like the window box and Scale. Never part of the rig or its card |
| Q6 | A percent scale below clamps to the room under the column, as pass-two Q37 clamps beside. The column never moves for her |
| Q7 | The Lookup reader stays beside the column at the column's height, on the wider free side |
| Q8 | Both chromes draw her below. The head view stays in the pill, unchanged |
| Q9 | Picking Below while the column is taller than the cap clamps the column to the cap at once and stores that height |
| Q10 | Under Below the column keeps its stored vertical position and she fills the room under it. That position clamps so her room is never less than what the cap leaves: the window height minus the cap minus the screen margin. At the cap height the column sits at the top. One constant drives the cap, the Auto rule and this floor. Under a percent scale the position clamps so her asked height fits; when it cannot fit even at the top, she shrinks to the room (Q6) (ticket 01) |
| Q11 | Below, she centers under the column, and the column's horizontal position clamps so she stays whole on the screen, as the beside layout does (ticket 01) |
| Q12 | The cap and the Below variant apply only while a whole Mascot is drawn. Mascot off or the head view leaves the column uncapped and the layout as today (ticket 01) |
| Q13 | The column's minimum height wins over the cap. On a screen where the cap is under the minimum height, Below cannot be honored and resolves to beside there; the stored Position stays Below and a taller window brings her back under. Auto stays beside there, as today. No second cap value (ticket 01) |

## User Stories

1. As a player, I want to put the Mascot under the chat, so that the chat and the Mascot read as one card.
2. As a player, I want the Mascot to stay beside the chat when I ask for Beside, so that a short chat never moves her.
3. As a player on Auto, I want her under a short chat and beside a tall one, so that she never shrinks to a sliver.
4. As a player on Below, I want the resize grip to stop at the cap, so that she always has room under the chat.
5. As a player on Below with a tall chat, I want the chat to shrink to the cap when I pick Below, so that she appears at once.
6. As a player, I want her to fill the room under the chat on Auto scale, so that a short chat gets a large Mascot.
7. As a player with a percent scale, I want her clamped to the room below, so that the chat never moves for her.
8. As a player, I want the Lookup reader beside the chat as before, so that reading and the Mascot never compete.
9. As a player on Full chrome, I want the same Position rules, so that the two styles agree.
10. As a player in the head view, I want the pill unchanged, so that a compact window stays compact.
11. As a player, I want the Position choice in the ⋮ menu, so that I can change it without opening Settings.
12. As a player, I want the General tab row and the ⋮ menu to agree, so that the two never fight.
13. As a player, I want my Position kept on this device, so that the window opens the way I left it.
14. As a player on a fresh device, I want the chat to open at 60% of the window height, so that it fits large and small screens alike.
15. As a player who drags the window, I want her to move with the column below it, so that the card stays whole.
16. As a player who drags the window to the screen bottom under Below, I want the column to stop above her, so that she stays on screen.
17. As a player who resizes across the cap on Auto, I want her to jump beside at once, so that the rule is plain.
18. As a player on mobile, I want the sheet unchanged, so that nothing new appears where she is not drawn.
19. As a player who exports a mascot card, I want it to carry no position, so that a card opens the same for everyone.
20. As a player who reads the ⓘ on the row, I want a plain line on what each value does, so that I can pick without trying all three.

## Implementation Decisions

### Window layout module

- The pure layout gains a placement input, Beside / Below / Auto, and a shared max-height constant as a fraction of the viewport height, 0.75 to start. One exported constant; the resize clamp under Below and the Auto rule both read it (Q1).
- The resolved placement for a frame is a pure function of placement, column height and viewport height (Q3). Beside resolves to today's layout. Below resolves to a column variant: the group is the column over the Mascot, bottom edge at the screen margin.
- Under Below the column's height clamps to the cap on every resize and on a placement change (Q1, Q9). The column's vertical position clamps so the Mascot's height fits under it.
- Her size below: Auto scale fills the room from the column's bottom edge to the screen margin at her aspect, width clamped to the screen. A percent scale takes the lesser of the asked height and that room (Q2, Q6).
- The reader keeps today's placement beside the column at the column's height (Q7). Width room for the reader is computed as today; the Mascot takes none of it under Below.
- The layout result gains the placement it resolved, so the window draws a row or a column and the head view reads nothing new (Q8).
- The default box takes 60% of the viewport height, clamped as today (Q4).
- Position is stored per device beside Scale, with the same read-and-write pair and the same fallback to the default on damaged or blocked storage (Q5).

### Window

- The window passes the stored placement into the layout and draws the group as a row (Beside) or a column (Below). Drag and resize keep routing through the layout's move and resize helpers, so they inherit the clamps.
- Both chromes draw the same two variants. The head view is untouched (Q8).
- The mobile sheet draws no Mascot and shows no Position row.

### General tab and menu

- The Window section gains a **Mascot Position** row after Chat Style, an OptionSwitcher Beside / Below / Auto. Hint, plain text under 12 words. The ⓘ defines the three values in one short line each (Q5).
- The ⋮ menu lists the same three values under a label, the current one marked, next to Chat Style. Both write the one per-device store.
- The Mascot switch's hint ("Shows a character beside a bare chat column") loses "beside", since she may stand below.

### Copy

- Labels in AP title case: **Mascot Position**, **Beside**, **Below**, **Auto**. "Mascot" stays the term; "character" leaves this hint.

## Testing Decisions

A good test calls the public seam with real inputs and asserts the observable result. It never reads internal fields or mirrors the formula.

- **Window layout module (existing seam).** Below: the group's bottom edge sits at the screen margin, the Mascot sits under the column at full column-free room, width from aspect. Auto: at and under the cap the placement is below; one pixel over, beside. Below: a resize past the cap returns the cap; a placement change with a taller column returns the cap. Percent scale below clamps to the room. The reader keeps its side and height under Below. The default box is 60% of the viewport height within the clamps. Prior art: the existing window layout tests for Q37 and the wider-side rule.
- **Per-device store.** Round trip; damaged and blocked storage return Auto. Prior art: the Scale store tests.
- **General tab and menu (existing render tests).** The row renders after Chat Style with the three values; choosing one writes the store; the menu shows the same values with the current one marked. Prior art: the Chat Style row and menu tests.
- **Guards bite.** Each clamp test is checked by reinstating the bug once: remove the cap clamp and the test must go red.

## Out of Scope

- Any change to the rig, the mascot card, or the Mascot tab.
- A transition when the placement flips.
- Hysteresis at the cap.
- The mobile sheet.
- A reader that spans the whole group.

## Further Notes

- The cap is a tuning value. After the build the user sets it from the live window; the constant is the one place to change.
- Pass-two Q37 (percent Mascot rises above the column beside; the column never moves) stays as is. Q6 here is its mirror for below.
