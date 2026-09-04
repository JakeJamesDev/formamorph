# 03 — Hot-spot file sweep

Status: done
Blocked by: 01

Migrate the highest-count surfaces, applying the spec's three buckets per site:

- SettingsModal (~26 native titles — audit; some are component props)
- MainMenu (~11)
- CommunityCreationsBrowser (~10)
- GameViewer (~9) and GamePanels (~7)
- MemoryManagerModal (~7), community cards/filter bar

Leave the settings info popovers untouched. Static-frame evidence per surface, both themes. Gates green.

## Comments

**The audit, per file.** The grep counts overcount badly. Real DOM `title` attributes: SettingsModal **1**
of 26 (the rest are `Section`, `ConfirmDialog` and `FullscreenShell` props) · MainMenu **7** of 11 ·
CommunityCreationsBrowser **7** of 10 · GameViewer **9** · GamePanels **6** of 9 · MemoryManagerModal
**8** of 9 · RemoteWorldCard **8** · CommunityFilterBar **2** · LikeButton **2**. Thirty-two of the
seventy-odd hits in these files were component props.

**Buckets as applied.** Icon-only controls dropped `title` *and* `aria-label` and took `tip` alone (the
menu hamburgers, refresh, sort order, the game toolbar, every memory-row action). Terse visible text took
`tip` + `labelsChild={false}` (Quarantined, Match Any/All, the dictionary legend chips, the endpoint chip,
Export, the Advanced marker). Two controls kept an `aria-label` richer or shorter than their tip on
purpose: the AI Context find bar, where the tip adds the keyboard shortcut the name should not speak, and
the card's contextual download, whose name stays short while the tip explains the update state.

**Counts name themselves only when the tip counts.** `LikeButton`'s plain count takes the tip as its name
("3 likes") because the heart is decorative and a bare "3" says nothing. The card's Downloads and Comments
spans do the opposite — their tip is the category, so naming them would replace the number with the word.

**One site needs the parts, not `Tip`.** MainMenu's Feedback button sits inside `TutorialPopover`, which
hands its child the anchor ref through a `Slot`. `Tip` is a plain function, so it would swallow that ref
and leave the tutorial popover pointing at nothing. Built from `Tooltip` / `TooltipTrigger` /
`TooltipPortal` instead, with the root outside the tutorial wrapper so the trigger *is* the anchored
element. **Ticket 04: any `title` inside a `TutorialPopover`, a `PopoverAnchor asChild`, or a dnd-kit
`setNodeRef` needs this shape.** A new wrapper case pins it (`tooltip.test.tsx`), proved by mutation —
swapping the parts back for `Tip` loses the anchor and the case goes red. The site itself could not be
exercised live: it needs a signed-in session, and dev points at the production API.

**A row is not a tip carrier.** MemoryManagerModal's `title` sat on the whole row div, wrapping the text
*and* the action buttons. Under Base UI that nests triggers, so hovering an action would open two tips.
The tip moved onto the row's `<p>`, which reaches exactly as far as the accent border it explains and is
absent while editing, exactly when that accent is. **`MemoryPanel.tsx` carries the identical row pattern —
ticket 04 should follow this.**

**One line taken outside the named files.** `MenuModal`'s Menu button renders *in* GameViewer's toolbar,
between two converted buttons, so leaving it native put one OS-drawn tip in a row of themed ones.

**Named, not fixed.** `MenuModal` aside, these were left for ticket 04: `StatRow` (the stat band
description), `StatDescriptorsSection`, `WebVersionChangelog` / `UpdateVersionControl` ("What's new"), and
`MemoryPanel`. Two icon-only buttons in GameViewer's toolbar — the BGM toggle and GamePanels' headphones
button — have **no** name at all, native or otherwise; they are not `title` sweep hits, so nothing in this
effort will catch them.

**A tip does not open on a disabled control** (measured: setting `disabled` on the community browser's
Refresh trigger stops the tip; clearing it opens the same hover). That leaves one piece of dead copy —
MemoryManagerModal's regenerate tip branches to 'Wait for the Current Turn to Finish' only while the
button is disabled, so that half can never be read. Reported rather than fixed: the fix is a wrapper
element around the disabled button, and whether that hint is worth one is a product call.

**Lint.** `TabsTrigger` added to `REF_SAFE_COMPOSED_CHILDREN`.

**Test relocations.** Two suites queried a `title` the sweep removed. `GamePanels.test.tsx` locates both
narration tools by role name — the name `Tip` now supplies, so it fails if the tip goes.
`RemoteWorldCard.likes.test.tsx`'s `heart()` helper reads the accessible name instead, and the
three-counts case now asserts all three read off one row; proved by mutation (pulling Downloads out of the
grid turns it red).

**Live proof, viewport 1440×900, dev-router on every surface.** Tip surface measured off computed styles
in both themes and matching `--popover` / `--popover-foreground` / `--border` each time — dark `bg
rgb(29,32,37)` / `fg rgb(244,244,246)` / `border rgb(55,59,67)`, light `rgb(252,252,253)` /
`rgb(26,29,35)` / `rgb(221,223,228)`, `text-helper` 14px, positioner `z-80` (over the dialog's 50).
Frames captured: main menu hamburger (dark), community Refresh catalog (light), in-game Edit World
(light), Hide UI (dark), Memory Manager Delete This Memory over its dialog (light), Settings' Advanced
marker (dark). `data-instant="delay"` observed moving between the community kind tabs. The Advanced
marker also proves the empty-tip contract live: with no hidden values off default the item renders with
no trigger attribute at all, and gains one the moment a hidden setting is changed. No React ref warnings
in the console across the whole pass.

**Gates.** typecheck 0 · lint 0 errors (2 pre-existing tsdoc warnings in `localNetworkEmbed.ts`) · 6865
tests pass in 40.0 s · build 14.0 s. Playwright e2e also run: 68 passed, 26 skipped, 3.9 min.
