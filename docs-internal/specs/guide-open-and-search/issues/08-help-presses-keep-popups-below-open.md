# 08: Help Presses Keep Popups Below Open

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A click, a focus move or Escape in the help window no longer closes a popup or dialog below it, such as a select in Settings or Settings itself (Q23, Q29).

- Today the dialog wrappers ignore a press in the shielded layer, but popovers, selects and menus do not. They close on any outside press or focus move, and likely on Escape.
- The popover, select and context-menu wrappers (the app has no dropdown-menu wrapper), plus the dialog, drawer and alert-dialog wrappers for Escape (Q29), ignore an outside press, focus move or Escape whose target is in the shielded layer, when their own content is outside the layer.
- A popup inside the help window keeps today's dismissal: a press elsewhere in help still closes it. The layer must keep passing presses to `document` (see the shielded-layer module comment).
- Check the Escape leak first and state the result. Fix it if it exists.
- The guard sits beside `ignoreLayerPress` and keeps the shielded-layer module import-free, so the account site bundle stays under its ceiling.
- Check other dismissable surfaces that sit below the layer (hover cards, the chip typeahead, Base UI popups) and name any that leak; fix the ones on the same wrapper pattern.

Spec: Implementation Decisions → Outside-press guard for popups.

Recommended model rationale: dismiss-layer event order across Radix and Base UI, with three past traps in this exact layer.

## Acceptance criteria

- [ ] With a Settings select or popover open, a click, a focus move and Escape in the help window leave it open; proven to bite by removing the guard.
- [ ] A menu inside the help window still closes on a press elsewhere in help; a press outside both still closes both.
- [ ] The site bundle boundary test passes.
- [ ] Verified live in the preview with a Settings popup open under the help window.
- [ ] Changelog fragment written; four gates green.
