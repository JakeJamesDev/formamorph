# Chat Layout — Spec

Status: ready-for-agent
Spec session: Chat-style narration page layout

The narration panel gets a second layout, **Chat**, beside the current **Pages** layout. Chat shows the
story as one vertical list of turns. Each turn is the player's action bubble and the narration bubble that
answers it. The scroll position selects the turn that the stats and the other panels show. Pages stays the
default, and nothing about it changes.

## Problem Statement

The narration panel shows one turn for each page. To read back, the player clicks the Pager one turn at a
time, and each click replaces the text on screen. The player cannot see how one turn led to the next, and a
long session feels like a stack of cards, not a story.

Players who know chat apps expect to scroll the story. They expect their own line to appear as a message,
the reply to grow below it, and the older text to stay in reach above.

## Solution

A player setting, **Narration Layout**, selects **Pages** or **Chat**. In Chat:

- The story is one scrollable list. The player's action is a compact bubble on the right. The narration is
  a full-width block below it.
- On submit, the action bubble moves to the top of the viewport. The narration streams in below it. The
  view does not move again by itself, so the action never leaves the screen unless the player scrolls.
- When text goes below the bottom of the viewport, a **Jump to Latest** button shows.
- The turn that crosses a reading line, 30% down the viewport, is the viewed turn. Stats, notes, and the
  other turn panels show the viewed turn, and the "Viewing turn N of M" banner shows as it does today.
- Choices show under the latest narration as player bubbles, so a choice reads as the next message.
- Each narration bubble has a row of icon actions at its bottom. The same actions show in a right-click
  menu, so the player does not scroll to the bottom of a long turn to reach them.
- Rollback is a per-bubble **Rewind to Here** action with the confirm dialog of today.

## User Stories

1. As a player, I want a Narration Layout setting with Pages and Chat, so that I select how I read the story.
2. As a current player, I want Pages to stay the default, so that an update does not change my game view.
3. As a player, I want the setting to apply to all worlds and saves, so that I set it one time.
4. As a player, I want to change the layout during a game and stay on the same viewed turn, so that I can compare the two.
5. As a player, I want my action to show as a bubble on the right, so that I see my own lines apart from the narration.
6. As a player, I want narration to use the full width, so that long prose stays easy to read.
7. As a player, I want the first turn, which has no action, to show only its narration, so that the list starts clean.
8. As a player, I want a loaded save to open at the latest turn, so that I continue where I stopped.
9. As a player, I want my action to move to the top of the viewport when I submit, so that the full reply has room below it.
10. As a player, I want the view to hold still while text streams, so that I read without chasing the text.
11. As a player, I want my action to stay on screen until I scroll, so that I keep the context of the reply.
12. As a player, I want the pin scroll to animate, so that I see where the view went.
13. As a player with reduced motion set, I want the pin scroll to be instant, so that the view does not animate.
14. As a player, I want the fade-in reveal to continue below the fold, so that the text is ready when I scroll down.
15. As a player, I want a Jump to Latest button when the newest text is off screen, so that I return in one action.
16. As a player, I want that button to say that new text is below while a reply streams, so that I know why it shows.
17. As a player, I want the view to stay manual after I scroll, so that the view never fights my scroll.
18. As a player, I want Jump to Latest to land on the end of the latest text, or on my action when the turn is short, so that I always see the newest content.
19. As a player, I want the live reasoning block to show inside the latest narration bubble, so that thinking models look the same as in Pages.
20. As a player, I want the stats to follow the turn I scroll to, so that I see my state at that point of the story.
21. As a player, I want the stat bars to snap, not animate, while I scroll through history, so that a fast scroll does not queue animations.
22. As a player, I want the stat bars to animate on submit as they do today, so that a new turn still shows its changes.
23. As a player, I want the notes tab to show and edit the notes of the viewed turn, so that Chat matches Pages.
24. As a player, I want the "Viewing turn N of M" banner in its current place, so that I know the panels show history.
25. As a player, I want the latest turn selected when I am at the bottom, so that a short last turn is never skipped.
26. As a player, I want a submit to act on the latest turn no matter where I scrolled, so that reading history never changes my game.
27. As a player, I want the choices to show only under the latest narration, so that old turns stay short.
28. As a player, I want the choices to look like unsent player bubbles, so that a choice reads as my next message.
29. As a player, I want a choice click to put its text in the input, with the same append gesture as Pages, so that I can edit or combine choices before I send. The sent text becomes my action bubble.
30. As a player, I want the Continue the Story choice in the same bubble style, so that all choices look alike.
31. As a player, I want a Re-generate Choices icon under the choices, so that the control sits with the thing it changes.
32. As a player, I want Re-generate Narration and Re-generate Stats as icons on the latest narration bubble, so that the controls sit with the text they change.
33. As a player, I want all re-generate controls as icon buttons with tooltips, so that the bubbles stay compact.
34. As a player, I want Edit, Read Aloud, and Copy Text on each narration bubble, so that I can act on any turn.
35. As a player, I want Generate Scene Image on a bubble that has no image, so that I can add one to any turn.
36. As a player, I want a More icon on the row that opens the full menu, so that touch and mouse reach the less common actions.
37. As a player, I want Write Scene Tags and Re-generate TTS in that menu, so that no Pages action is lost in Chat.
38. As a player, I want a right-click on a narration bubble to open the same actions, so that I do not scroll to the end of a long turn.
39. As a player, I want a right-click on the choices to offer Re-generate Choices, so that all bubbles behave alike.
40. As a player, I want a right-click on my action bubble to offer Edit and Copy Text, so that I can fix a typo in my own line.
41. As a player, I want a right-click on selected text to open the browser menu, so that Copy and Search still work on a selection.
42. As a touch player, I want a long press to open the bubble menu, so that I get the same actions without a mouse.
43. As a player, I want Rewind to Here on each past narration bubble, so that I select the rollback target directly.
44. As a player, I want Rewind to Here to ask for confirmation, so that a wrong click does not delete turns.
45. As a player, I want Rewind to Here last in the menu, after a separator, in the destructive color, so that I do not select it by accident.
46. As a player, I want the actions disabled while a reply streams, so that I cannot start two requests.
47. As a player, I want scene images inline in their turns, so that the history keeps its pictures.
48. As a player, I want an image to hold its space before it loads, so that the text below does not move.
49. As a player, I want Export Story and the other whole-story options in the panel's top-right control, so that they stay where they are in Pages.
50. As a player, I want no Pager in Chat, so that the scroll is the one way to move through turns.
51. As a player with a long save, I want the list to open fast and scroll without jumps, so that a thousand turns feel like fifty.
52. As a mobile player, I want the pin and the Jump button to work with the on-screen keyboard open, so that Chat works on a small screen.
53. As a keyboard user, I want each icon action reachable by Tab with a visible focus ring, so that I do not need a mouse.
54. As a screen reader user, I want each icon button to have a label, so that I hear what it does.
55. As a screen reader user, I want each turn to expose its turn number, so that I know where I am in the list.
56. As a maintainer, I want one action list to feed the icon row and the menu, so that the two cannot drift.
57. As a maintainer, I want the scroll barrier to write the same page state that the Pager writes, so that every panel derivation stays as it is.
58. As a maintainer, I want the geometry rules as pure functions, so that unit tests cover them without a browser.
59. As a maintainer, I want the scroll mechanics covered by the browser test suite, so that a virtualizer upgrade cannot break the pin without a failed test.

## Implementation Decisions

### Setting

- A new player setting, **Narration Layout**, with the values `pages` and `chat`. The default is `pages`. It
  follows the pattern of the other enum display settings: a type, an options list, and a default in the
  settings defaults module, persistent state in the Settings context, and an option switcher row in the
  Settings modal.
- The setting has no environment default twin. It is not part of a world or a save, so **no export shape
  changes**.
- The design system showcase mirrors the control, as it does for the other switcher settings.

### State model

- Chat keeps the page model. The scroll barrier writes the same "user page" state that the Pager writes,
  and "null" still means "follow the latest turn". All derived view state (viewed snapshot, viewed choices,
  stat deltas, notes, the history banner) stays as it is.
- A submit resets the user page to follow the latest turn. This is the behavior of today, in both layouts.
- Rollback keeps its current code path and confirm dialog. Chat gives it an explicit turn index from the
  bubble, where Pages uses the current page.
- Gameplay still never writes the authored world. No new field goes into the save envelope.

### Chat list

- The middle panel renders one of two bodies by the setting. The Pages body is the code of today. The Chat
  body is a new component tree. The action input, the progress bar, and the top-right options control are
  shared.
- The list is virtualized with `@tanstack/react-virtual`, which is already a dependency. One virtual item is
  one turn (action plus narration), so the barrier works on whole turns.
- Turns sit in **normal flow** between a top spacer and a bottom spacer. The spacers carry
  `overflow-anchor: none`. No ancestor of a turn changes height or padding during a scroll, because that
  suppresses the browser's scroll anchoring. The virtualizer's own scroll correction is turned off
  (`shouldAdjustScrollPositionOnItemSizeChange` returns false) and `useFlushSync` is off. The prototype
  measured 32 programmatic scroll writes in 120 wheel ticks with absolute positioning and the default
  correction, and 0 with this arrangement.
- Where the browser has no scroll anchoring, the virtualizer's own correction stays on as the fallback. The
  implementer verifies which engines need it from a live source, not from recall.
- The turn that the player just submitted gets a minimum height of one viewport. This is what lets the last
  turn reach the top. It keeps that minimum height until the next submit.
- Open-at-bottom and Jump to Latest re-aim for a few frames until the target holds, because sizes above the
  target settle after the first scroll.
- Committed narration renders in static mode and keys by content, as in Pages. Only the live turn animates.

### Geometry rules (pure functions)

- **Viewed turn:** the turn whose top is at or above the reading line and whose bottom is below it. If the
  list is at the bottom, the latest turn. If no turn crosses the line, the nearest turn above it. The line is
  30% of the viewport height.
- **Jump target:** `max(turnTop, contentEnd - viewportHeight)`, limited to the maximum scroll offset. A short
  turn lands with its action at the top. A long turn lands with its end at the bottom.
- **Jump button visible:** the latest turn is not mounted, or its content end is below the viewport bottom,
  or its content end is above the viewport top.
- The scroll handler runs the viewed-turn rule one time for each animation frame.

### Pin

- On submit and on Re-generate Narration, the view scrolls the turn's top to the viewport top. The scroll is
  smooth, and instant under reduced motion. The pin scrolls the element directly, not through the
  virtualizer's index scroll.
- Scrolls that the code starts do not count as player scrolls.

### Bubble actions

- One pure builder returns the action list for a bubble from its context (latest or past, busy states,
  image present). Each action has a key, a label, an icon, a section, a disabled flag, and a handler. The
  icon row and the context menu both render this list. The shape from the prototype:

  ```ts
  interface BubbleAction { key: string; label: string; icon: ReactNode; section: 'generate' | 'content' | 'destructive'; disabled?: boolean; run: () => void }
  ```

- Narration bubble, latest turn: Re-generate Narration, Re-generate Stats, Generate Scene Image (only with
  no image), Edit, Read Aloud, Copy Text. Behind the More icon and in the menu: Write Scene Tags,
  Re-generate TTS.
- Narration bubble, past turn: the same without the two re-generate actions, plus Rewind to Here.
- Choices block: Re-generate Choices, as an icon under the choices and as a menu row.
- Action bubble: Edit and Copy Text, menu only, no icon row. **Edit on a player action is a new
  capability.** It rewrites the user message in the history, as the narration edit rewrites the assistant
  message.
- Copy Text is a new action. It copies the turn's markdown source.
- The menu follows the context menu grammar: action rows carry icons, sections are generate, content,
  destructive, a separator divides sections, and the destructive row uses the destructive color. The menu
  uses the app's shared context menu primitives, which already handle long press.
- A right-click on a non-collapsed selection inside the bubble disables the trigger for that press, so the
  browser menu opens.
- A live turn has no actions and no menu.
- Icons: refresh for narration, chart for stats, list-restart for choices. The user approved these.
- The top-right options control stays in Chat and holds only the whole-story items, for example Export
  Story. The per-turn items leave it in Chat.

### Choices

- Choices render for the latest turn only, right-aligned, in the action bubble shape with a dashed border
  and a light fill. Hover and focus fill them to the solid action style. The Continue the Story choice uses
  the same style.

### Dev tooling and docs

- The dev router gets a way to open the game view in Chat layout in one call, and the drift-guard test
  stays green.
- The changelog gets one In Progress entry in the user-facing bucket.

## Testing Decisions

A good test here asserts what the player sees or what the game state becomes. It does not assert a class
name, a hook call, or the virtualizer's internals.

- **Geometry functions (unit).** Viewed turn: a turn that crosses the line, two short turns in view, no turn
  on the line, and the at-bottom rule. Jump target: a short turn, a long turn, and the clamp. Jump button:
  the three visibility cases. Prior art: the pure helpers and tests of the turn history module and the stat
  bar geometry.
- **Bubble action builder (unit).** Latest against past, busy states, image present, and that Rewind to Here
  is the only destructive row. Prior art: the Locations Canvas menu section builder tests.
- **Chat body under the real providers (GamePanels harness).** With the setting on Chat: choices show for
  the latest turn only; a choice click stages its text in the input as in Pages; Rewind to Here opens the confirm dialog and rolls back to the
  index of the bubble; Re-generate controls call their handlers; the icon row and the menu list the same
  actions; a live turn has no actions. With the setting on Pages: the body is unchanged. The harness needs a
  stub for the virtualizer's element measurement, because jsdom has no layout; the stub mounts all staged
  turns.
- **Scroll mechanics (Playwright).** Pin: the action top sits at the viewport top and the scroll offset
  stays constant through a stream that goes past the fold. Jump to Latest shows, works, and hides. Barrier:
  over a wheel scroll through history, the banner's turn matches the turn on the reading line at every step.
  No programmatic scroll writes occur during a wheel scroll. A save of 1000 turns opens at the bottom with a
  small mounted count. Prior art: the four probe scripts on the prototype branch, which already encode these
  checks. This suite stays outside the four gates, as the e2e suite is today.
- Motion is never asserted in seconds. The pin test samples frames and counts frames with movement.
- Each new guard is proven once by reinstating the bug it guards.

## Out of Scope

- A turn-jump control (for example "Turn N of M"). Scroll and Jump to Latest are the only navigation in the
  first version.
- A world-level or save-level layout preference.
- A change of any kind to the Pages layout.
- Showing past choices in history.
- Holding the fade-in reveal at the fold.
- The parked Chat World / SillyTavern parity work. This spec is a layout only.
- A change to the prompts, the turn pipeline, or the save format.

## Further Notes

- **Prototype:** branch `prototype/chat-layout`, worktree `.claude/worktrees/prototype-chat-layout`, last
  commit `4233a3d7`. Launch entry `proto-chat-layout` on port 5197, page
  `/docs-internal/specs/chat-layout/prototype.html`. The prototype files live only on that branch.
- **Question and verdict:** do pin-to-top, a bubble that grows while it streams, the reading line, and
  virtualization work together in a real browser? Yes. With 1000 turns the virtualized list mounted 5 turns
  in 4 ms at about 40 MB of heap; the fully mounted list took 972 ms, 17,643 nodes, and 82 MB.
  `content-visibility` gave no real gain, because React still mounts every turn.
- **Hidden preview pane.** The pane sends no scroll events while hidden, so a virtualized list there never
  updates its range and looks broken. Verify scroll behavior with Playwright.
- **Headless limit.** Headless Chromium does not animate wheel scrolls, so the probes cannot show the feel of
  a scroll. The user reviewed the build with native anchoring on and approved it. If a rough scroll returns,
  compare with the prototype's **Native scroll anchoring** checkbox first.
- The prototype's probe text is short and has no real images. Real saves use more memory per turn than the
  numbers above.

## Comments

- **Ruling: live turn in ticket 01 (spec session, 2026-09-18).** Ticket 01 shows the latest turn's live
  reveal and the live reasoning block by the same rule as Pages, so a submit never shows an empty bubble.
  Ticket 02 adds the pin, the minimum height, and Jump to Latest, and keeps its reasoning-block criterion as
  a check.
- **Ruling: image aspect box (spec session, 2026-09-18).** The intent is the image's real aspect, not a fixed
  16:9; the prototype's 16:9 was a placeholder. A pure function that reads the size from the image header,
  with a square fallback, is the approved way. The size is never stored in the save, because that changes the
  export shape. An image that is a URL, not a data URL, takes the fallback box.
- **Ruling: choice click (user, 2026-09-18).** Chat keeps the Pages contract. A click puts the choice text in
  the input, Ctrl/Cmd+click or a long press appends it, the staged choice shows filled (the solid action
  style), and the player presses send. The ticket 04 line "a choice click submits" is superseded; the spec
  session wrote it from the prototype without the Pages contract in view.
- **Ruling: submit-acts-on-latest test (spec session, 2026-09-18).** No new seam. The harness test covers
  the panel side: with a past turn viewed, the input and Send stay enabled, the send handler is called, and
  the choices are the latest turn's. The reset to follow-latest is existing GameViewer behavior that both
  layouts share; the Playwright barrier test checks that the banner clears after a submit.
- **Ruling: TTS actions and action targets (spec session, 2026-09-18).** "Read Aloud" and "Re-generate TTS"
  were prototype labels, not new behavior. They are the two Pages items: **Text to Speech** (opens the TTS
  modal; row icon, headphones) and **Regenerate Audio** (synthesizes the text again; More menu; only with a
  model loaded). Use the Pages labels, so one term names one thing in both layouts. Chat adds no new TTS
  behavior. If the TTS path takes a turn's text without rework, past bubbles offer both items for their own
  text; if it is tied to the latest gameplay text, only the latest bubble offers them and the ticket records
  the gap. Every per-turn action acts on its own bubble's turn, never on the viewed turn. Re-generate
  Narration and Re-generate Stats act on the latest turn only.
- **Open gap: scene image controls in Chat.** Pages shows scene images with a pager, zoom, and delete. Ticket
  01 may ship a plain inline image. No ticket restores those controls yet; the user decides where they go.
