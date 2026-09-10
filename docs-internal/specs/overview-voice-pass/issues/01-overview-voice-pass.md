# 01: Overview Voice Pass

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

The whole spec in one unit: two column managers reordered and brought onto the panel conventions, with the tests, the wiki page, and the changelog. No shared machinery is touched.

## What to build

On the World Editor's Overview tab, the left column reads World Name, Author, Tags, Thumbnail, 3D Player Avatar, Background Music. The Generate button sits directly under the thumbnail at the frame's width. The avatar checkbox is labeled "3D Player Avatar" with a Hint under it that says the player can customize it; when it is on, the VRM upload keeps its Add or Change, Preview, and Remove buttons with its note as a Hint. Background Music uses the shared sound upload with its dropzone, player, and remove control, as the location panel's Ambient Sound does.

The right column reads World Description, Readme, System Prompt Addition, Custom Prompts. The Readme keeps its Introduction and Gameplay tabs; each field's guidance moves from placeholder text to a Hint under the field. The Custom Prompts picker and its behavior are unchanged; its footer notes become Hints.

Both columns take the panel voice: labels are names in title case, every aside is a Hint or an info popover, hints use the shared typography component, placeholders are plain rather than "Enter world name...", section spacing matches the panels, and the thumbnail label focuses the widget it names. Simple mode shows the same orders minus the VRM upload and Custom Prompts. Mobile stacks both columns in the same order.

Nothing about what a field stores changes, and Find still lands and rings on every Overview field. The wiki's World Editor page follows the new order and labels.

## Acceptance criteria

- [ ] Advanced: left column labels read World Name, Author, Tags, Thumbnail, 3D Player Avatar, Background Music, in that order.
- [ ] Advanced: right column labels read World Description, Readme, System Prompt Addition, Custom Prompts, in that order.
- [ ] Simple: the same orders minus the VRM upload and Custom Prompts.
- [ ] Generate sits directly under the thumbnail frame at its width.
- [ ] The avatar checkbox label is "3D Player Avatar"; its explanation is a Hint under it, not a parenthetical.
- [ ] Background Music renders the shared sound upload; adding a sound shows the player and the remove control, and removing clears it.
- [ ] The VRM note, the readme guidance, and the Custom Prompts footers are Hints; no raw muted spans remain in either column.
- [ ] Placeholders are plain; no field says "Enter world name..." or "Enter author name...".
- [ ] The thumbnail label focuses the upload widget.
- [ ] A Find hit on the Gameplay readme opens that tab and rings; a Find hit on a stored narration prompt opens that kind.
- [ ] World Editor bench-harness tests cover the orders in both modes, the sound widget, the avatar hint, and the two Find cases; the overview manager suites and the find-focus suite still pass.
- [ ] The wiki's World Editor page follows the new order and labels.
- [ ] Changelog: one 👤 entry in the In-Progress bucket.
- [ ] Desktop verified in the preview at 1600x900 against the location Media tab and the entity Profile tab; mobile stacking verified at 375px with static evidence; no export-shape change.
- [ ] Four gates green; graph updated.

## Blocked by

- None (can start immediately)
