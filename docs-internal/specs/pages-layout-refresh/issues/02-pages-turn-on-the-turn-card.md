# 02: Pages Turn on the Turn Card

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: edits the narration panel monolith, deletes a control path, and rewrites existing tests without weakening them.

## What to build

The tracer slice. In Pages, the viewed turn shows inside a Turn Card: the player's action line, the reasoning
block, the narration, and the action row. A right-click on the narration opens the same actions as a menu.

- The `You:` and `Event:` labels are removed. The action line has a left rule in the primary color, a muted
  color, and the label text role. It is **upright, never italic**, so the player's own italics and quote
  styling still show. The opening page has no action line.
- The panel's one function that binds handlers to a turn feeds Pages too. For the viewed page: `isLatest` is
  "not viewing past", `live` is "latest and revealing", `text` is the page's narration.
- A past page gets **Rewind to Here** with the existing confirm dialog. The confirm dialog and the edit
  target state serve both layouts without a layout condition.
- Delete the Pages-only action code: the corner pencil, the per-turn items of the corner More menu, the
  **Re-generate** split button with its flyout, and the **Rollback** button. The corner keeps the narration
  badge and a More menu with **Export Story** only.
- The bottom row holds the location suggestion and the Pager, centered at every width.
- Choices and the scene panel stay as they are in this ticket. **Re-generate Choices** loses its flyout home,
  so it shows as the choices builder's icon under the choice buttons, latest page only.

The prototype wraps the whole page in the narration's menu. Do not copy that; the card's menu covers the
card only.

## Acceptance criteria

- [ ] Pages shows the card, the action line, and the action row; no `You:` or `Event:` text
- [ ] The action line is upright; `*italic*` and quoted speech in a player action render with their own style
- [ ] Latest page row and menu: Re-generate Narration, Re-generate Stats, Generate Scene Image, Edit, Text to Speech, Copy Text, with Write Scene Tags and Regenerate Audio behind More, under the same conditions as Chat
- [ ] Past page: Rewind to Here opens the confirm and rolls back on confirm
- [ ] No action row while the narration streams; actions disabled while a turn generates
- [ ] No pencil, no Re-generate button, no Rollback button; the corner More menu holds Export Story only
- [ ] Re-generate Choices is reachable on the latest page and absent on a past page
- [ ] TTS playback bar and sentence highlight work as before
- [ ] **Parity test** in the GamePanels harness: for a latest turn and a past turn, the action labels of the row and of the right-click menu are equal in Pages and in Chat. Prove it bites: add an action to one layout by hand, confirm red, remove it
- [ ] The "renders the latest page unchanged" and "renders a past page unchanged" cases are rewritten to the new body, not deleted
- [ ] Verified in the preview at desktop size, both themes
- [ ] Four gates green
