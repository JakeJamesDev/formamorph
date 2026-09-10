# Overview Voice Pass

Status: ready-for-agent
Status note: Follow-up to the five-panel voice pass. That pass gave the tabbed panels one voice and stopped at the Overview tab, which is not a list panel and has no strip. This spec applies the same rules to Overview's two columns and settles their order. No tabs; the earlier grounding rejected them for Overview because the column split already groups it and its heavy sections already fold.

## Problem Statement

The World Editor's Overview tab is two forms, the world's identity on the left and its writing on the right. Both were built before the panel conventions were settled, so they read differently from the five list panels an author has just been editing: help lines in the old muted span, a parenthetical in a checkbox label, "Enter world name..." placeholders, a hand-rolled music upload where the location panel uses the shared sound widget, and the Generate button centered under the thumbnail rather than under the picture as the entity and location panels place it. The order in each column also splits like with like: on the left the avatar setting sits between the tags and the thumbnail, and on the right the AI-facing prompt sections sit between the description and the readme.

## Solution

Overview keeps its two columns and takes the panel conventions.

- **Left column order**: World Name, Author, Tags, Thumbnail, 3D Player Avatar with its VRM upload, Background Music. The listing fields first, then the avatar setting, then music last.
- **Right column order**: World Description, Readme, System Prompt Addition, Custom Prompts. Player-facing text first, AI-facing text after, and the Advanced-only section last.
- **Widgets**: Background Music uses the shared sound upload with its dropzone, player, and remove control. The VRM upload keeps its Add or Change, Preview, and Remove buttons. The thumbnail's Generate button sits directly under the picture at the frame's width.
- **Voice**: every help line is the shared Hint under its field or an info popover beside its label. The avatar checkbox loses its parenthetical to a Hint. Placeholders follow the panels' plain style. Section spacing matches the panels. The thumbnail label focuses the widget it names.

Nothing about what a field stores changes, and Find still lands on every Overview field.

## User Stories

1. As a world author, I want the Overview columns to read like the panels I just edited, so that the editor has one voice from end to end.
2. As a world author, I want the listing fields first on the left, so that the library card's name, author, tags, and picture are one block.
3. As a world author, I want the avatar setting under the thumbnail and the music last, so that the one setting sits between the picture and the sound rather than splitting the card.
4. As a world author, I want the Generate button directly under the thumbnail, so that it is clear it makes that picture.
5. As a world author, I want Background Music to use the same dropzone as a location's Ambient Sound, so that adding, hearing, and removing a sound works the same in both places.
6. As a world author, I want the description and readme together on the right, so that the player-facing text is one block.
7. As a world author, I want the prompt sections after the readme, so that the Advanced-only Custom Prompts section is last and Simple mode's column ends cleanly.
8. As a world author, I want the avatar checkbox to say what it does in a hint rather than in parentheses, so that the label is a name and the explanation is where every other field puts it.
9. As a world author, I want the VRM note and the prompt footers in the shared hint style, so that guidance looks the same on every field.
10. As a world author, I want the readme guidance under the field rather than inside it as placeholder text, so that it stays visible once I start typing.
11. As a world author, I want the placeholders to read like the panels' placeholders, so that no field says "Enter world name...".
12. As a world author using Find, I want a hit on any Overview field to still land and ring, so that the reorder changes nothing about navigation.
13. As a keyboard author, I want the thumbnail label to focus its widget, so that the label is not decoration.
14. As a Simple-mode author, I want the same order minus the Advanced fields, so that the mode hides fields without reshuffling them.
15. As a mobile author, I want both columns to stack in the same order they read on desktop, so that nothing moves between sizes.
16. As a reviewer, I want the wiki page for the World Editor to follow the new order and labels, so that the docs match the screen.

## Implementation Decisions

- **Two files, no shared machinery.** The left-column manager and the right-column manager are edited in place. No tab module, no ledger entry, no find-focus map; Find already reaches these fields.
- **Left column composition.** World Name, Author, Tags, Thumbnail with Generate directly under the frame at the frame's width, 3D Player Avatar checkbox with a Hint that says the player can customize it, the VRM upload when the checkbox is on with its buttons and a Hint, then Background Music through the shared sound upload.
- **Right column composition.** World Description, Readme with its Introduction and Gameplay tabs and a Hint under the field for each, System Prompt Addition, Custom Prompts. The Custom Prompts picker and its footers are unchanged in behavior; the footer notes become Hints.
- **Voice rules** are the ones the panel pass recorded: labels are names in title case, asides move to a Hint or an info popover, hints use the shared typography component, placeholders are plain, section spacing matches the panels.
- **Find keys are unchanged.** The reorder moves fields on screen, not in the search targets.
- **No export-shape change.** Nothing about the overview record changes.
- **Design authority.** No new pattern. Desktop is checked in the preview against the location panel's Media tab for the sound widget and the entity panel's Profile for the Generate placement. Mobile stacking is checked at 375px with static evidence.
- **Changelog.** One 👤 entry in the In-Progress bucket.

## Testing Decisions

A good test drives the real World Editor on the Overview tab and asserts on labels, order, and where Find lands. It never reaches into a widget's state.

- **One seam: the World Editor bench harness**, as for the panels. Tests open Overview in each mode and assert the field order by label, the presence of the hints, and that a Find hit on the readme and on a stored custom prompt still opens its tab and rings.
- **Cases.**
  - Advanced: left column labels in the new order; right column labels in the new order.
  - Simple: the same orders minus the VRM upload and Custom Prompts.
  - Background Music: the shared sound widget renders; adding a sound shows the player and remove control.
  - The avatar checkbox label is a name; its explanation is a hint.
  - Find hit on the Gameplay readme opens that readme tab; Find hit on a stored narration prompt opens that kind.
- **Existing suites.** The overview manager suites and the find-focus suite keep passing.

## Out of Scope

- Tabs on Overview. Rejected in grounding.
- Any change to what the fields store or to the export shape.
- The Custom Prompts picker's shape and the Readme tabs' shape.

## Further Notes

**Why this and not tabs.** Overview is two forms side by side, not a list panel. Its heavy sections already fold: Custom Prompts opens nothing by default, and Readme has its own two tabs. A strip over the right column would nest tabs. The column split is the grouping; this pass makes each column read in one order and one voice.

**Decisions taken with the user.** Left order with music last. Right order player-facing first. Shared sound widget for music. One ticket.
