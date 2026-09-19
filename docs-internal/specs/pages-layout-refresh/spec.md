# Pages Layout Refresh — Spec

Status: ready-for-agent
Spec session: Page Layout UI modernization

The **Pages** narration layout gets the surfaces and the turn actions of the **Chat** layout. One shared
component renders a turn's narration in both layouts, so the action row, the right-click menus, and the
scene image controls cannot drift apart. The shared action input and the left and right panels do not change.

## Problem Statement

Chat shipped with a card surface, an icon action row, right-click menus, and bubble choices. Pages still
shows `You:` and `Event:` labels, yellow player text, raw prose on the panel, heavy outlined choice buttons,
a pencil and a More menu in the corner, and a large **Re-generate** / **Rollback** button beside the Pager.
Beside Chat, Pages looks dated.

The two layouts also hold their turn actions in different places and build them through different code. An
action added to one layout does not appear in the other. Pages cannot edit a player action; Chat can. Chat
cannot browse, zoom, or delete a scene image; Pages can.

## Solution

In Pages, one turn shows as:

- A **card** (`bg-card`, the Chat narration surface) that holds, in order: the scene image, the player's
  action line, the reasoning block, the narration, and the action row.
- The **action line** replaces the `You:` label. It is the player's text with a left rule and a muted color.
  It is upright, so the player's own italics and quote styling still show. The `Event:` label is removed.
- The **action row** at the bottom of the card is the Chat row: the turn number, then icon actions, then
  **More**. A right-click on the narration opens the same actions as a menu.
- A right-click on the action line opens the player-action menu: **Edit** and **Copy Text**.
- **Choices** are numbered rows under the card: a number, the text, a fill on hover, the primary fill when
  the choice is staged. **Re-generate Choices** is an icon under the rows.
- The **scene image** sits at the top of the card as a plate. A click zooms it. Hover or focus shows browse
  arrows, the count, and delete. A turn with no image shows no plate.
- The scene panel under the narration keeps the job status and the tag row. It no longer shows the image.
- The bottom row holds only the Pager, centered. The corner keeps the narration badge and a More menu with
  the whole-story item, **Export Story**.

In Chat, the inline scene image becomes the same plate, so Chat gains zoom, browse, and delete. Nothing else
in Chat changes to the eye.

## User Stories

1. As a player in Pages, I want the narration on a card surface, so that Pages looks like the same app as Chat.
2. As a player, I want my action shown as a quiet line above the narration, so that the page reads as prose and not as a log.
3. As a player, I want no `You:` and `Event:` labels, so that one turn on one page has no redundant labels.
4. As a player, I want my action line upright, so that italics and quote styling in my own text still show.
5. As a player, I want quoted speech in my action to keep the dialogue style, so that it matches the narration.
6. As a player, I want an icon row under the narration, so that the turn's actions are where I finish reading.
7. As a player, I want the turn number in that row, so that I know which turn I act on.
8. As a player, I want a right-click on the narration to list the same actions, so that I do not scroll a long turn to reach them.
9. As a player, I want a right-click on selected text to keep the browser menu, so that I can still copy a selection.
10. As a touch player, I want a long press to open the same menu, so that touch has the same actions.
11. As a player on the latest page, I want Re-generate Narration, Re-generate Stats, Generate Scene Image, Edit, Text to Speech, and Copy Text as icons, so that the common actions take one click.
12. As a player, I want Write Scene Tags and Regenerate Audio behind More, so that the row stays short.
13. As a player on a past page, I want **Rewind to Here** in the row, so that rollback is where the other turn actions are.
14. As a player, I want Rewind to Here to keep the confirm dialog, so that I do not lose turns by accident.
15. As a player on a past page, I want Edit and Copy Text, so that past turns stay usable.
16. As a player, I want the actions disabled while a turn generates, so that I cannot start two requests.
17. As a player, I want no action row while narration streams, so that the row does not move under the text.
18. As a player, I want a right-click on my action line to offer Edit and Copy Text, so that I can correct my own action in Pages as I can in Chat.
19. As a player, I want Edit on my action to change only my action, so that the narration stays as written.
20. As a player, I want choices as numbered rows, so that they read as a list and not as a wall of buttons.
21. As a player, I want a staged choice to show the primary fill, so that I see what is in the input.
22. As a player, I want a click to stage a choice and Ctrl/Cmd+click or a long press to append it, so that the click contract does not change.
23. As a player on a past page, I want the choice I took highlighted and the rows disabled, so that history reads as a record.
24. As a player, I want the continue choice as the last row with its own mark, so that it is distinct from generated choices.
25. As a player, I want Re-generate Choices as an icon under the rows, so that it sits with the thing it changes.
26. As a player, I want Re-generate Choices hidden on a past page, so that I cannot re-roll history.
27. As a player, I want the scene image at the top of the card, so that the picture sets the scene before the prose.
28. As a player, I want no plate when the turn has no image, so that the page has no empty box.
29. As a player, I want to click the image to zoom, so that I can see it at full size.
30. As a player, I want arrows and a count when a turn has more than one image, so that I can browse earlier draws.
31. As a player, I want to delete the image I look at, so that a bad draw does not stay.
32. As a keyboard player, I want the plate controls to show on focus, so that I can reach them without a pointer.
33. As a player, I want the tag row to stay under the narration in every state, so that I can fix tags by hand and draw again when an image exists.
34. As a player, I want the draw progress and the live preview to show as they do today, so that a running draw stays visible.
35. As a Chat player, I want the same plate in each turn, so that I can zoom, browse, and delete images in Chat.
36. As a Chat player, I want the image box sized before the image loads, so that the text below does not move.
37. As a player, I want the Pager alone and centered in the bottom row, so that the row has one job.
38. As a player, I want Export Story to stay in the corner menu, so that the whole-story action is not on a turn.
39. As a player with TTS audio, I want the playback bar above the narration as it is today, so that audio controls do not move.
40. As a player, I want the sentence highlight during playback to work on the card, so that karaoke reading still works.
41. As a player, I want the reasoning block above the narration inside the card, so that it stays with its turn.
42. As a player, I want both themes and my palette to apply to the card and the rows, so that the refresh follows my settings.
43. As a mobile player, I want the rows and the icon row to fit a narrow screen, so that Pages works on a phone-width window.
44. As a developer, I want one component to render a turn's narration in both layouts, so that a surface change lands once.
45. As a developer, I want one action builder to feed the row and the menu in both layouts, so that an added or removed action shows in all four places.
46. As a developer, I want a test that fails when the layouts list different actions for the same turn, so that drift cannot ship.

## Implementation Decisions

### One Turn Card

- A new **Turn Card** component owns the narration surface: the context menu wrapper, the card classes, and
  the action row. It takes the action list and the turn number, and it takes its body as children (plate,
  action line, reasoning, narration).
- Chat's narration bubble and the Pages page both render a Turn Card. The card classes, the menu, and the row
  exist in one place. Neither layout composes the menu and the row by hand.
- The Turn Card hides the row when the action list is empty or the turn is live.
- Layout-only differences stay with the caller: Chat puts the plate under the narration, Pages puts it at the
  top; Pages puts the action line inside the card, Chat keeps the action bubble outside it.

### One action list

- The existing pure action builders stay the only source of turn actions: the narration builder, the
  player-action builder, and the choices builder.
- The panel's one function that binds handlers to a turn feeds both layouts. Pages calls it for the viewed
  page: `isLatest` is "not viewing past", `live` is "latest and revealing", `text` is the page's narration.
- The Pages-only action code is deleted, not kept beside the new path: the corner pencil, the per-turn items
  of the corner More menu, the **Re-generate** split button with its flyout, and the **Rollback** button.
- The rewind confirm dialog and the edit target state serve both layouts without a layout condition.
- The corner keeps the narration badge and a More menu with **Export Story** only, in both layouts.

### Action line

- The player message renders through the markdown renderer with the dialogue style, inside its own context
  menu fed by the player-action builder. A context-menu event on the line does not reach the card's menu.
- Style: left rule in the primary color, muted foreground, the label text role. Not italic.
- Edit on the line uses the existing player-action edit path from Chat. It rewrites the turn's user message
  and leaves the turn's memory digest as it is.
- The opening page has no action line.

### Choice rows

- A new choice-row list replaces the outlined buttons in Pages. Each row is a button with a number cell and
  the choice text with its bold and quoted runs. The continue choice is the last row with a chevron mark.
- The rows keep the shared press handlers, so stage and append do not change. Chat keeps its bubbles.
- Selected rows take the primary fill, and the quote color inherits there for contrast.
- The choices builder's actions render as icons under the rows, and only on the latest page.

### Scene Plate

- A new **Scene Plate** component shows one turn's images: the newest first in view, zoom on click, and an
  overlay with previous, count, next, and delete that shows on hover and on focus within.
- It sizes its box from the image header before the image loads, as Chat's inline image does today. That
  inline image component is removed.
- Delete takes the turn, not only the viewed page, so Chat can delete from any turn's plate. The delete
  handler's contract changes from "index on the viewed turn" to "turn id and index".
- The scene panel loses its image, its browse arrows, and its delete button. It keeps the job status, the
  live preview during a draw, and the tag row with its three buttons. It shows when the turn has an image, a
  job, or a tag line.

### Bottom row

- In Pages the row holds the location suggestion and the Pager, centered at every width.

### Dev tooling and docs

- No new screen or modal, so no dev-route entry. The `mode=pages|chat` route override covers both layouts.
- The Design System guide's narration section and its showcase reference gain the Turn Card, the choice
  rows, and the Scene Plate.
- One changelog entry in the In-Progress section, player bucket.
- No setting, no save shape, and no world shape changes.

## Testing Decisions

A good test here reads what the player can see and do: which actions a turn offers, what a click changes. It
does not read class names or component structure.

- **Layout parity (GamePanels harness).** Load one save. For the latest turn and for a past turn, collect the
  action labels of the row and of the right-click menu in Pages, then in Chat. The four lists for one turn
  must be equal. The same check runs for the player-action menu. This is the drift guard. Prove it bites:
  add an action to one layout by hand, confirm red, remove it. Prior art: the GamePanels Chat layout test
  file, which already renders both layouts under the real providers.
- **Pages behavior (GamePanels harness).** No `You:` or `Event:` text. No Re-generate or Rollback button.
  Rewind to Here on a past page opens the confirm and rolls back on confirm. Edit on the action line changes
  the user message and not the narration. A row click stages the choice; Ctrl+click appends. A past page
  disables the rows and marks the taken choice. Re-generate Choices is absent on a past page. The plate is
  absent with no image and present with one; delete removes the image in view. The tag row shows when an
  image exists.
- **Action builders (unit).** The existing builder tests stay. They need no change unless an action changes.
- **Existing Pages tests.** The "renders the latest page unchanged" and "renders a past page unchanged"
  cases describe the old body. Rewrite them to the new body in the same commit; do not delete the cases.

No Playwright case. Nothing here depends on scroll or animation.

## Out of Scope

- The shared action input, the left and right panels, the memory bar, and the TTS playback bar.
- Reading width. The narration card is about 48% of the window on desktop, so a column cap does nothing.
- A lighter Pager.
- Bubble choices in Pages.
- Any change to which actions exist, their labels, or their icons.
- The reveal animation and its pending minimum-duration decision.

## Further Notes

- **Prototype:** branch `prototype/pages-layout`, worktree `.claude/worktrees/prototype-pages-layout`, last
  commit `87dcde00`. Launch entry `proto-pages-layout`, port 5200. URL
  `/?v=B&sample=1#dev?view=gameViewer&fixture=whiteRoom&mode=pages`; add `&cp=1` and `mode=chat` for the
  plate in Chat. The bar at the bottom center opens on pointer enter.
- **Question and verdict.** Round one asked which of six ideas make Pages match Chat. Kept: action header,
  action row, row choices, image plate with nothing when there is no image. Dropped: reading width, light
  pager, bubble choices. Round two asked which surface suits that base. Verdict: **B, Card Page**. The user
  also approved the player-action menu on the action line and the plate in Chat.
- **Prototype traps to not copy.** It wraps the whole page in the narration's menu and stops the event on
  the action line; the real build gives each its own trigger. Its plate does not size its box before load.
  Its Chat delete is a stub. It reassigns a parameter in the scene panel.
- This closes the open gap recorded in the Chat Layout spec: scene image controls in Chat.

## Comments

- **2026-09-19, build close-out.** The prototype branch and the verdict above did not change during the build. One premise was wrong: the Design System guide had no narration section, so ticket 07 created `## Pattern: Narration Turn` with one showcase reference for the Turn Card, the Scene Plate, and the choice rows. The reference leaves the Pages action line out, because that line is inline markup in the Pages host.
