# Entity Panel Tabs

Status: ready-for-agent
Status note: Shape settled by prototype on branch `prototype/entity-panel` (see Further Notes). Desktop composition approved by the user on 2026-09-09; the mobile form still needs a look in context before the pattern is recorded in the Design System guide.

## Problem Statement

In the World Editor, selecting an entity fills the right panel with one flat column of every field the entity has. In Advanced mode that column is eleven labeled blocks and close to three screens tall: name and aliases, three description editors, type, locations, a tall image gallery with its tags, a 3D model slot, and an embedded placeholder editor. Nothing groups them. An author editing a complex world scrolls past the prose to reach the picture, past the picture to reach the placeholders, and loses track of which entity the panel is showing. The other list tabs have the same shape but fewer fields, so Entities is where it hurts first.

## Solution

The entity panel becomes a small tabbed form. Three tabs sit at the top of the panel:

- **Profile** — who the entity is. The picture gallery sits at the left; Name, Aliases, Type, and Image Tags sit beside it; Locations and the 3D model follow on their own full-width lines.
- **Descriptions** — the three prose fields for the two audiences: Player-Facing Description, AI-Facing Description, AI-Facing Summary.
- **Placeholders** — the entity's own placeholder editor, filling the tab instead of sitting in a fixed box. Advanced mode only, like the top-level Placeholders tab.

There is no Media tab. The picture belongs with the identity, and the Generate button stays under the picture it makes.

The tab an author picks stays picked while they click through the entity list. Find and the Test Bench still land on any field: navigating to a hit opens the tab that holds it.

Simple mode shows the same tabs minus Placeholders, with the Simple field set inside them: Profile holds Image, Name, Locations; Descriptions holds the two descriptions.

## User Stories

1. As a world author, I want the entity panel split into Profile, Descriptions, and Placeholders, so that I see one kind of thing at a time instead of a three-screen column.
2. As a world author, I want the entity's picture beside its name, so that I recognize which entity I am editing without scrolling.
3. As a world author, I want Image Tags in the wide column beside the picture, so that the tag text is readable rather than squeezed under the gallery.
4. As a world author, I want the Generate with AI button directly under the picture strip, so that it is clear the button makes a picture and not tags.
5. As a world author, I want Locations on its own full-width line, so that the chip list stays one line tall instead of stacking in a narrow column.
6. As a world author, I want the 3D model slot below Locations, so that the rarely used field does not push the identity fields down.
7. As a world author, I want the three description editors together on one tab, so that I can write the player and AI versions side by side without other fields between them.
8. As a world author, I want the Placeholders tab to use the panel's full height, so that the placeholder list and its detail are not cramped into a fixed box inside a scroll.
9. As a world author, I want the tab I chose to stay chosen when I select another entity, so that I can review every entity's descriptions in a row.
10. As a world author, I want the panel to fall back to Profile when the current tab disappears, so that switching to Simple mode while on Placeholders never leaves me on an empty panel.
11. As a world author using Find, I want a hit inside a description to open the Descriptions tab and ring the field, so that navigation still reaches text that is not on screen.
12. As a world author using Find, I want a hit in Name, an alias, Type, or Image Tags to open the Profile tab, so that every searchable entity field is reachable.
13. As a world author using Find and Replace, I want replacement to work on fields in a tab that is not showing, so that the tab split does not change what Replace covers.
14. As a world author using the Test Bench, I want Open on an entity finding to land on that entity with its tabs intact, so that triage flows into editing.
15. As a world author on the top-level Placeholders tab, I want Open on an entity owner node to land on that entity's Placeholders tab, so that I arrive where its placeholders are edited.
16. As a Simple-mode author, I want Profile to show only Image, Name, and Locations, so that the tab stays as lean as the flat panel was.
17. As a Simple-mode author, I want the Generate with AI button to stay available, so that the tab split does not remove a feature I had.
18. As a Simple-mode author, I want no Placeholders tab, so that the panel matches the mode's promise of just the essentials.
19. As a mobile author, I want the three tabs to fit the detail view without horizontal page scroll, so that the panel works on a phone.
20. As a mobile author, I want the Profile columns to stack with the picture first, so that nothing is clipped at 375px.
21. As a keyboard author, I want the tab strip to move focus with the arrow keys and keep the shared focus ring, so that the panel matches every other tab strip in the app.
22. As a world author, I want the content-link header to stay above the tabs, so that a linked entity's status is visible on every tab.
23. As a world author, I want the placeholder palette bar to stay above the tabs, so that inserting a chip works on every tab that has a chip field.
24. As a world author, I want the entity group panel unchanged, so that a group's single Name field does not gain tabs it does not need.
25. As a library user editing a character card, I want the character modal to keep working, so that the shared field body's rearrangement does not break the off-world editor.
26. As a developer, I want a dev-router entry for the entity panel's tabs, so that a test or a session can land on Descriptions in one call.
27. As a developer, I want the tab layout covered by tests at the World Editor level, so that Find, Bench, and mode switching are proven against the real panel.
28. As a reviewer, I want the Design System guide to record the pattern once the mobile form is approved, so that the next list panel that gets tabs follows the same composition.

## Implementation Decisions

- **Tabs live in the World Editor's entity manager.** The entity manager renders the tab strip and its three panels. The entity group manager is untouched. The library character modal keeps its own outer tabs and does not gain the Profile/Descriptions split; it continues to render the field body stacked.
- **The shared field body is split into named groups.** The single shared entity-fields component becomes a set of field groups (identity fields, description fields, gallery, model) exported from one place, so the World Editor composes them into tabs and the library modal composes them into a stack. No field is rendered by two components.
- **Tab set and order.** Profile, Descriptions, Placeholders. Placeholders appears only in Advanced mode. Each tab has a leading icon and a label. The strip spans the panel width with equal-width triggers, using the shared Tabs component.
- **Profile composition.** At `sm` and wider, a two-column grid: an 18rem left column holding the gallery frame, the thumbnail strip, and the Generate with AI button; a flexible right column holding Name, Aliases, Type, Image Tags in that order. Below the grid, full-width: Locations, then 3D Model. Below `sm`, one column with the gallery first. Aliases, Type, Image Tags, and 3D Model are Advanced only, as today.
- **Descriptions composition.** Player-Facing Description, AI-Facing Description, AI-Facing Summary stacked, each with its existing AI-generate control. Summary is Advanced only, as today.
- **Placeholders composition.** The existing hint line, then the scoped placeholder editor sized to the remaining panel height with a sensible minimum, not a fixed 26rem box.
- **The image widget separates its tags from its gallery.** The gallery widget stops rendering Image Tags itself. It exposes the tags field as a separately placeable piece that shares the widget's state (the embedded-prompt adoption and tag generation still write the same value). The prototype used a portal to prove the layout; production does not use a portal. The Generate with AI button stays inside the gallery piece and keeps today's visibility in both modes. Every other host of the widget keeps its current rendering with no visual change.
- **Tab persistence.** The chosen tab survives the per-entity remount for the life of the editor session. It is held by the World Editor, not by module state. When the chosen tab is not available (Simple mode has no Placeholders), the panel shows Profile.
- **Find navigation opens the owning tab.** The entity manager accepts the same focus-field hint the Overview panel already takes from Find. Field keys map to tabs: `name`, `aliases[n]`, `type`, `imageTags` open Profile; `playerDescription`, `aiDescription`, `aiSummary` open Descriptions. The tab switch happens before the existing reveal-and-ring timer runs, so the ring lands on a rendered field.
- **Replace is unaffected.** Replace edits the record through the search target's writer, not the DOM, so hidden tabs need no change.
- **Bench and owner-node navigation.** The editor's item navigation gains an optional tab hint. Bench findings pass none and land on the persisted tab. The placeholder owner node's Open passes Placeholders.
- **Dev-router coverage.** A `subtab` ledger entry for the entity panel (`profile`, `descriptions`, `placeholders`) alongside the existing Locations `list`/`canvas` entry, guarded by the same drift test.
- **No export-shape change.** Nothing about the entity record changes. This is a rendering change only.
- **Design authority.** The Tabs component and the labeled-block fields are existing patterns. The two-column Profile is a new composition. Desktop was approved in context through the prototype; the implementer shows the mobile form in context and, on approval, adds the pattern to the Design System guide and showcase together per the guide's "Adding an approved pattern" section.
- **Changelog.** One 👤 entry in the In-Progress bucket.

## Testing Decisions

A good test drives the real World Editor with a loadable world and asserts what an author sees and where navigation lands. It never reaches into the tab component's state or the field groups' props.

- **One seam: the World Editor bench harness.** The existing harness that renders the editor on a world in a chosen mode is the seam. Tests select an entity, click tabs, and assert on labels, on which fields are present, and on which tab is active. Prior art: the Bench and find-focus World Editor suites.
- **Cases at that seam.**
  - Advanced: three tabs; Profile shows Image, Name, Aliases, Type, Image Tags, Locations, 3D Model and no description; Descriptions shows the three prose fields and nothing else; Placeholders shows the scoped editor.
  - Simple: two tabs; Profile shows Image, Name, Locations and the Generate with AI button; no Aliases, Type, Image Tags, or 3D Model.
  - Tab persists across selecting another entity.
  - On Placeholders, switching to Simple lands on Profile.
  - Find hit in AI-Facing Description from the Profile tab opens Descriptions and rings the field; Find hit in Image Tags from Descriptions opens Profile.
  - Placeholder owner node Open lands on the entity's Placeholders tab.
  - Entity group selection shows the group panel with no tab strip.
- **Image widget.** The widget's existing gallery and generate suites keep passing unchanged for hosts that render it whole. One new case proves the separately placed tags field still adopts an uploaded image's embedded prompt and still receives generated tags. Prior art: the widget's own three suites.
- **Dev-router.** The existing ledger drift test covers the new `subtab` entry.
- **Library modal.** The existing modal tests keep passing; no new cases unless the split changes what it renders.

## Out of Scope

- The other list tabs (Locations, Stats, Traits, Dictionary). They come next, each as its own spec, reusing whatever field-group pattern this one lands.
- A Media tab, or any second home for the picture.
- Changing what Simple mode shows in the gallery (the remove and URL controls stay as on `main`).
- Redesigning the library character modal's outer tabs.
- Any change to the entity record or export shape.
- Recording the pattern in the Design System guide before the mobile form is approved.

## Further Notes

**Prototype.** Branch `prototype/entity-panel`, worktree `.claude/worktrees/prototype-entity-panel`, launch entry `proto-entity-panel` in the main checkout's launch file (Vite on port 5191 from the worktree). Variants switch with `?variant=` and a floating bar; `?variant=A2` is the winner. Commits, oldest first:

| Commit | What it answered |
| --- | --- |
| `045de7da` | Round 1: tabs vs collapsible sections vs profile card vs side rail. Tabs won. |
| `f254a1d9` | Round 2: where the image joins Profile. Read-only portrait, full gallery in Profile, small avatar. Full gallery won. |
| `f6236d0c` | Image Tags moved to the right column beside the picture. |
| `84e232ac` | A wrong turn: gated Generate to Advanced. Reverted by the next commit. |
| `7d1b61e5` | Final shape: only tags move right; Generate stays under the picture. |

**Why the alternatives lost.** Collapsible sections only shorten the panel when the author closes things and keep the placeholder editor boxed. The side rail keeps everything on one scroll and needed scroll-spy that the preview pane could not verify. The profile card with an audience switch hid two of three descriptions. A read-only portrait made the author leave Profile to change the picture; a small avatar was too small to read.

**Measurements from the flat panel** (Ember Speckle in the Veilwood world, Advanced, 1600x900): panel scroll height 2477px against an 873px viewport. The winning Profile tab fits in one screen with no scroll at the same size.

**Known gap to carry into the implementation.** The prototype's image widget change is a portal; the production split is a real decision for the implementer to make cleanly. The tab persistence in the prototype is module-level state; production keeps it in the editor.
