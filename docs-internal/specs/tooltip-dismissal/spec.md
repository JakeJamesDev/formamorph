# Tooltip Dismissal

Status: ready-for-agent
Spec session: tooltip-dismissal — spec
Status note: Follows the done themed-tooltips effort. Decisions settled in chat on 2026-10-09.

## Problem Statement

A hover tip stays open after its reason is gone. When the player scrolls, the tip stays attached to its control and slides off the screen with it. The pointer is no longer on the control, so the tip no longer describes anything under it.

The same fault shows in other places:

- A drag that starts on a control leaves the tip open. Tips then open on each control the drag crosses.
- A tip stays open when the window loses focus or the tab is hidden. It is still there when the player comes back.
- A menu, dialog or popover that opens from a shortcut or from the control leaves the tip open. Tips sit above dialogs, so the tip covers the new layer.
- The **Copied** bubble on a help code block (FlashTip) floats in place when its button scrolls away.
- The dev-only reload banner still uses the browser's native title tooltip.

## Solution

Every tip in the app closes when the pointer or focus leaves its control in any way. Scroll, a press anywhere, a drag, a right-click, focus that moves somewhere else, window blur and a hidden tab all close the open tip. No tip opens while a pointer button is held down.

The tooltip module owns this behavior. No call site has to opt in, and no call site can drift from it. The native-title lint rule also covers the account site, and the dev reload banner moves to a themed tip.

## User Stories

### Scroll

1. As a player, I want a tip to close when I scroll with the wheel, so that it doesn't slide off the screen with its control.
2. As a player, I want a tip to close when I scroll an inner panel, such as the chat log or an editor list, so that nested scroll areas behave like the page.
3. As a player, I want a tip to close when I scroll with the keyboard, so that Page Down and the arrow keys behave like the wheel.
4. As a player, I want a tip to close when I drag a scrollbar, so that every scroll method behaves the same.
5. As a laptop player, I want a tip to close when I scroll with a touchpad gesture, so that gestures behave like the wheel.
6. As a player, I want a new tip to open normally after I stop scrolling and rest on a control, so that tips still work after a scroll.

### Drag

7. As an author, I want the tip to close when I start to drag a library tile, so that the tip doesn't follow the drag.
8. As an author, I want no tip to open on the controls my drag crosses, so that the board stays clear while I drag.
9. As an author, I want tips to work again after I drop, so that the next hover shows its tip.
10. As an author, I want the same behavior in the Trait Tree and every sortable list, so that all drag surfaces act alike.
11. As an author, I want a native browser drag, such as a file or an image, to close the tip too, so that every kind of drag acts alike.

### Press and right-click

12. As a player, I want a tip to close when I press anywhere, so that a click never leaves a stale tip behind.
13. As a player, I want a tip to close when I right-click, so that it doesn't cover the context menu that opens.

### Menus, dialogs and focus

14. As a player, I want a tip to close when a menu opens from its control, so that the tip doesn't cover the menu.
15. As a player, I want a tip to close when a keyboard shortcut opens a dialog, so that the tip doesn't sit on top of the dialog.
16. As a keyboard player, I want a focus tip to close when focus moves to another place, so that only the focused control shows a tip.
17. As a keyboard player, I want the next control's tip to open when I tab to it, so that closing on focus change doesn't break keyboard tips.

### Window and tab

18. As a player, I want a tip to close when I switch to another window, so that it isn't still open when I come back.
19. As a player, I want a tip to close when I switch browser tabs or minimize the desktop app, so that a hidden page doesn't keep a tip open.

### Rich tips

20. As a player, I want the rich tips (the undo step list, the demo AI notice, the main menu card tip) to follow the same rules, so that no tip behaves differently.

### Copied bubble

21. As a player, I want the **Copied** bubble to close when I scroll its button away, so that it doesn't float over other text.
22. As a player, I want the **Copied** bubble to close on blur and on the other triggers, so that it follows the same rules as every tip.
23. As a player, I want the **Copied** bubble to show again the next time I copy, so that an early close doesn't hide later confirmations.

### Native titles

24. As a site visitor, I want every hint on the account site to be a themed tip, so that the site matches the game.
25. As a developer, I want the dev reload banner's file list to show in a themed tip, so that no native title tooltip is left in the app.
26. As a developer, I want lint to block a native title on the account site, so that one can't come back.

### Developer contract

27. As a developer, I want the dismissal rules to live in the tooltip module, so that a new tip gets them with no extra code.
28. As a developer, I want the rich-tip root that the module exports to carry the same rules, so that a hand-built tip can't skip them.
29. As a developer, I want no call site to need a scroll or blur listener of its own, so that the rule has one owner.

## Implementation Decisions

### Rulings

- **Q1. One owner.** The tooltip module owns all dismissal. Call sites get it with no change and can't opt out.
- **Q2. Close triggers.** These events close the open tip:
  - `scroll` anywhere in the document, caught in the capture phase, since scroll doesn't bubble.
  - `pointerdown` and `contextmenu` anywhere.
  - Native `dragstart`.
  - `focusin` on an element outside the open tip's trigger.
  - Window `blur`, and `visibilitychange` to hidden.
- **Q3. Suppress while pressed.** No tip opens from hover while a pointer button is held. The hold ends on `pointerup` or `pointercancel`. This covers dnd-kit drags, which start with a press and move past an activation distance.
- **Q4. FlashTip follows the same rules.** The **Copied** bubble closes on the Q2 triggers, though its owner still passes `open`. A dismissed bubble stays closed until its owner opens it again.
- **Q5. The dev banner converts.** The dev reload banner moves into React, inside the dev-only tree, so its file list can use `Tip`. It stays behind the dev-only gate.
- **Q6. The lint rule covers the site.** The native-title rule's scope grows from the game sources to the account site. A scratch run over the site on 2026-10-09 found no violations, so the extension needs no conversions.
- **Q7. Popovers are out.** Popovers and hover cards keep their current behavior. A popover is a place the player works in, so it stays open and follows its anchor.

### Tooltip module

- `TooltipProvider` installs the Q2 listeners and the Q3 press state once, at mount. It closes the shared root through its handle. Every `Tip` uses that shared root.
- The exported `Tooltip` root changes from a direct re-export of the Base UI root into a wrapper. The wrapper adds the same dismissal through the root's imperative actions. The three hand-built rich tips use this root, so they get the rules with no call-site edits.
- The press state from Q3 is shared. Both the shared root and the wrapped root read it, so neither opens during a hold.
- FlashTip uses the same wrapped dismissal. It keeps a dismissed flag that resets when `open` goes from false to true.
- Base UI 1.7 has no close-on-scroll option. Its change reasons don't include scroll, blur or drag. So the module closes tips through `handle.close()` and `actionsRef.close()`.

### Dev reload banner

- The banner moves from imperative DOM building into a React component. It mounts only under the dev-only gate. Its file list becomes the text of a `Tip` on the summary line.

## Testing Decisions

- **One seam: the tooltip module**, tested in the existing tooltip test file through `TooltipProvider`, `Tip`, the wrapped `Tooltip` root and `FlashTip`. Call sites need no tests of their own.
- A good test opens a tip through focus, which jsdom handles reliably, then fires the trigger event and expects the popup to be gone. Tests check what the player sees, never listener counts or internal state.
- Cases:
  - Each Q2 trigger closes a `Tip`. Scroll is fired on a nested scroll container, not only on the document.
  - A focus move to another tipped control opens that control's tip, so Q2's focus rule doesn't break keyboard tips.
  - Hover opens nothing while a pointer button is held, and works again after release.
  - The wrapped `Tooltip` root closes on scroll.
  - FlashTip closes on scroll and shows again on the next open.
- Each guard must bite. Remove a listener, and its test must fail.
- Prior art: the existing tooltip test file (provider render helper, focus-driven opens, Base UI mounts counted by pass-through wrappers). Also the FlashTip query in the CodeSnippet test.
- The lint rule extension is checked by running lint. The dev banner is checked once in the dev preview.

## Out of Scope

- Popovers, hover cards, menus and toasts (Q7).
- Tap-to-open tips on touch devices. Base UI keeps tips off on touch on purpose.
- Changes to tip timing, delay or group behavior.
- The landing page in `hosting/`. It is static HTML with no tips, and it has no native titles.

## Further Notes

- The capture-phase scroll listener also fires on scrolls that code starts, such as a reveal that scrolls a row into view. That is the correct result: the control moved, so the tip should close.
- The suppression in Q3 also stops tips from opening during text selection with the mouse. That matches native behavior.
