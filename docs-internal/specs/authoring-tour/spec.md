# Spec: Authoring Tour

Status: ready-for-agent
Spec session: Spec: Authoring Tour
Status note: 13 tickets in `issues/`. The user approved the example world (Appendix A) and the Settings placement on 2026-09-23.
Workspace: branch `feature/authoring-tour`, worktree `.claude/worktrees/authoring-tour`. Every ticket is built there, never on `main`. See Further Notes → Workspace.

## Problem Statement

A new author opens the World Editor and sees six tabs of fields. Each field has an ⓘ tip, but a tip only says what a field is for. It does not show what the field does. The author cannot see where a field shows up for the player, or what text the AI actually reads from it.

This hides the most important idea in authoring: most things have a **player-facing** side and an **AI-facing** side, and the two never meet. An author who does not know this writes lore into a Player-Facing Description, which the AI never reads. They also write stage directions into an AI-Facing Description and expect the player to see them.

One label makes this worse. The Overview field **World Description** only appears on the library card. The AI never reads it. The field the AI does read as the world's description is labeled **System Prompt Addition**.

The only way to learn this today is to play the world and read the AI context viewer, turn by turn.

## Solution

An **Authoring Tour** walks a new author through the World Editor's Simple tabs while they build a real world. Each step points at one field. Beside the editor, the **In Play** pane shows that field's effect as the author types:

- **Player Sees**: the real game component the field appears on.
- **… Prompt Reads**: the exact text each AI prompt reads from the field, with the author's own text marked. A field the AI never reads says so.

The tour order is Overview → Locations → Entities → Stats → Traits → Dictionary. It covers the core fields of each tab, about twenty steps. Each step has **Use Example**, which fills in text from one consistent example world. The tour saves after each step, resumes where the author left off, and ends with **Play**.

In Play shows only what the game computes from the authored world. It never calls an AI (ADR-0005).

Before the tour, two Overview labels change so that Overview follows the same player/AI pairing as the other tabs:

| Today | Becomes |
|---|---|
| World Description | Player-Facing Description |
| System Prompt Addition | AI-Facing Description |

## User Stories

**Starting the tour**

1. As a new author who just created a world, I want the editor to offer the Authoring Tour, so that I can learn while I build the world I just made.
2. As a new author opening the editor on an existing world for the first time, I want the same offer, so that I find the tour even if I did not start from New World.
3. As an author, I want **No Thanks** on the offer, so that I can build on my own.
4. As an author who declined once, I want the offer never to come back, so that the app does not nag me.
5. As an author who declined and later changed my mind, I want a **Start Authoring Tour** button in Settings, so that I can still take the tour.
6. As an author who finished the tour, I want to take it again from Settings, so that I can refresh what I learned.
7. As an author who starts the tour from Settings or from an existing world, I want the tour to create a new world, so that it never edits a world I already care about.
8. As an author who accepts the offer on a new blank world, I want the tour to fill that world, so that I do not end up with an extra empty world.
9. As an author with a game running, I want Settings not to offer the tour mid-game, so that I do not lose my game by accident.

**Moving through steps**

10. As a tour user, I want each step to point at one field with a short note, so that I always know what to fill in.
11. As a tour user, I want **Next** to unlock once the field has any text, so that I cannot skip past a field and leave In Play empty.
12. As a tour user, I want no minimum length, so that the tour does not feel like homework.
13. As a tour user, I want **Use Example** on each step, so that I can move on when I have no idea of my own.
14. As a tour user, I want **Use Example** to count as a value, so that **Next** unlocks after I use it.
15. As a tour user, I want **Previous**, so that I can look at an earlier field's effect again.
16. As a tour user, I want a step counter such as "5 / 20", so that I know how long the tour is.
17. As a tour user, I want steps that add something (a location, an entity) to point at the Add button, so that I learn where new items come from.
18. As a tour user, I want the tour to select the item I just added, so that the next step's field is on screen.
19. As a tour user, I want the tour to visit Locations before Entities, so that my entity has a place to be when the AI reads the scene.
20. As a tour user, I want to click around the editor freely during the tour, so that I can explore without breaking it.
21. As a tour user who wandered to another tab, I want a tour bar with **Back to Tour**, so that I can return to the current step in one click.
22. As a tour user, I want **End Tour** always within reach, so that I can stop at any point.
23. As a tour user who deleted an item the tour created, I want the tour to ask me to add a new one, so that the tour cannot get stuck.

**The In Play pane**

24. As a tour user on desktop, I want In Play docked beside the editor, so that I see the field and its effect at the same time.
25. As a tour user, I want In Play to show only the current step's slice, so that the field's effect is easy to find.
26. As a tour user, I want **Player Sees** to show the real game component, so that I see exactly what a player will see.
27. As a tour user, I want each AI section to name the prompt that reads it, so that I learn the AI is more than one request.
28. As a tour user, I want my own text marked inside the AI text, so that I can see where my words land.
29. As a tour user, I want In Play to update as I type, so that cause and effect are immediate.
30. As a tour user, I want a field the AI never reads to say "The AI never reads this field", so that I learn the difference between player-facing and AI-facing text.
31. As a tour user, I want a field the player never sees to say so under **Player Sees**, so that the contrast works both ways.
32. As a tour user on mobile, I want **Show Effect** on the step note to open In Play in a bottom sheet, so that I get the same view on a small screen.
33. As a tour user with the Test Bench docked, I want In Play to take the dock while the tour runs, so that the two panes do not fight for space.
34. As a tour user, I want the Bench's flask popover to still work during the tour, so that I can check my world if I want to.

**Overview**

35. As a tour user naming my world, I want In Play to show my name on the library card, so that I see where players find it.
36. As a tour user, I want the World Name step to say the AI never reads the name, so that I do not rely on it for lore.
37. As a tour user filling the AI-Facing Description, I want In Play to show it at the top of the narration prompt, so that I understand it frames every turn.
38. As a tour user, I want that step to say the player never sees this text, so that I write it for the AI and not for the reader.

**Locations**

39. As a tour user naming a location, I want In Play to show the Location tab with its name, so that I see what the player reads while there.
40. As a tour user writing a Player-Facing Description, I want to see it in the Location tab and see that the AI never reads it, so that I put scene details for the AI in the other field.
41. As a tour user writing an AI-Facing Description, I want to see it in the narration prompt's location block, so that I know what the AI builds the scene from.
42. As a tour user ticking Starting Location, I want In Play to show that a new game begins there, so that I understand the checkbox.
43. As a tour user adding a second location and a Connection, I want to see it under Connected Locations for the player and in the destinations list the Location Change prompt reads, so that I understand how travel is offered.
44. As a tour user writing a Travel Hint, I want to see it attached to the destination in the AI text, so that I know the AI reads it as a route.

**Entities**

45. As a tour user naming an entity, I want to see the name in the game's entity list and in the AI's roster, so that I see both sides at once.
46. As a tour user setting Pronouns, I want to see them in the AI's roster and see that the player never sees them, so that I know they steer the AI's writing only.
47. As a tour user writing an entity's Player-Facing Description, I want to see it in the entity card and see that the AI never reads it, so that I know where the AI's picture of the character comes from.
48. As a tour user writing an entity's AI-Facing Description, I want to see it in the roster and see that the player never sees it, so that I can put secrets and motives there.
49. As a tour user whose entity has no location yet, I want In Play to say the AI never reads an entity that is in no location, so that I understand why placing it matters.
50. As a tour user placing the entity in a location, I want to see it appear in that location's roster, so that I understand presence.

**Stats**

51. As a tour user naming a stat and setting Min, Max and Initial Value, I want to see the stat bar the player sees, so that I understand the numbers.
52. As a tour user, I want to see that the narration prompt never reads the stat's number or Description, so that I know what narration can and cannot see.
53. As a tour user writing the stat's Description, I want to see it in the Stat Updates prompt's text with the numbers, so that I know the Description tells the AI how to change the stat.
54. As a tour user, I want the step to say the player never sees the Description, so that I write it for the AI.

**Traits**

55. As a tour user naming a trait and writing its Player-Facing Description, I want to see it on the setup screen, so that I know what a player chooses from.
56. As a tour user writing the trait's AI-Facing Description, I want to see it in the narration prompt's traits block, so that I know how the AI learns who the player is.
57. As a tour user adding a Stat Change, I want to see it on the setup screen and see the stat bar start at the changed value, so that I understand how traits shape a new game.

**Dictionary**

58. As a tour user creating an entry, I want to set a name, trigger keywords and a value, so that I learn the parts of an entry.
59. As a tour user, I want a test line prefilled with one of my keywords, so that I see the entry appear in the AI text.
60. As a tour user, I want to edit the test line and watch the entry vanish when no keyword is left, so that I understand entries load only when mentioned.
61. As a tour user, I want the step to say the player never sees dictionary entries, so that I know they are background knowledge for the AI.

**Mode, saving and resuming**

62. As an author who normally uses Advanced, I want the tour to show Simple while it runs, so that the fields match the tour.
63. As that author, I want my own mode back after the tour, so that the tour does not change my preference.
64. As a tour user, I want the Simple/Advanced toggle locked during the tour with a tip that says why, so that I do not switch into fields the tour never covers.
65. As a tour user, I want the tour to save my world after each step, so that I never lose work.
66. As a tour user, I want the tour to point out the Save button once, so that I know how to save after the tour.
67. As a tour user who left halfway, I want the tour to continue at the next step when I reopen the world, so that I do not start over.
68. As a tour user who chose **End Tour**, I want the tour gone for that world, so that it does not return on the next visit.
69. As an author who deleted a world mid-tour, I want its tour progress removed, so that no stale state is left behind.

**Ending**

70. As a tour user on the last step, I want the Simple/Advanced toggle explained, so that I know more fields exist when I am ready.
71. As that user, I want the old one-time toggle note marked seen, so that I do not get the same explanation twice.
72. As a tour user who finished, I want a **Play** button that enters my world the normal way, so that I can play what I built right away.
73. As a tour user who finished, I want a pointer to the Test Bench flask, so that I know where to check my world later.

**Maintainers**

74. As a maintainer, I want every step's anchor checked in the gates, so that a renamed or moved field fails at commit time and not in front of a user.
75. As a maintainer, I want one end-to-end run that walks the whole tour, so that the tour cannot break silently.
76. As a maintainer, I want In Play to use the game's own context builders and components, so that it can never disagree with real play.
77. As a maintainer, I want the tour steps in one registry, so that there is one place to change a step.
78. As a maintainer, I want the tour reachable at any step through the dev router, so that a UI check takes one `goto`.

## Implementation Decisions

**Prerequisite: Overview relabel**
- Overview labels change: **World Description** → **Player-Facing Description**, **System Prompt Addition** → **AI-Facing Description**. Their ⓘ tips, editor-search labels and the wiki's World Editor page change with them.
- Labels only. The stored fields keep their names, and the `<WORLD DESCRIPTION>` prompt chip keeps its token and name. **No world export-shape change.**
- This ships as its own change before the tour.

**Authoring Tour module**
- A new module owns the tour: the step registry, the progress store and the tour controller. It is separate from the one-time tutorial engine because its steps complete on world state, persist per world, and force the editor mode. It reuses the tutorial layer's look, its topmost-screen layering, and its "stand down while a modal covers the anchor" behavior.
- **The step registry is the single source of truth.** Each step declares: its id, its tab, its anchor, which tour item it acts on, its completion predicate over the world, its example value, and its In Play slice.
- **Tour items.** The tour records the ids of the items it creates: first location, second location, entity, stat, trait and dictionary entry. Predicates read the world through these ids. If an item is deleted, the step that created it becomes current again and asks for a new one.
- **Completion.** **Next** is enabled when the step's predicate holds. The predicate is "the field has any value"; for an add step, it is "the tour item exists". **Use Example** writes the example through the same setters the panels use, so the world goes dirty and saves normally.
- **Steps never auto-advance.** A step whose field already has a value shows with **Next** enabled.

**Anchors**
- A field that a step points at carries a stable `data-tour-anchor` attribute. The step note positions against that element. No step anchors by label text.
- The attribute goes on each field's existing wrapper. The tour does not wrap fields in new components.

**Tour note and tour bar**
- The step note is non-modal and anchored, like the existing tutorial notes, with **Previous**, **Next**, **Use Example**, a step counter, and **Show Effect** on mobile.
- A tour bar in the editor header shows "Authoring Tour · 5 / 20", **Back to Tour** and **End Tour**. **Back to Tour** switches to the step's tab and selects its item.
- The editor stays fully usable during the tour.

**Entry points**
- **Offers** are one-time tutorial notes with two actions, **Start Tour** and **No Thanks**. There is one offer on a new blank world and one on the first editor visit to any other world. **They share one seen-state**, so declining either retires both, and taking the tour retires both.
- The tutorial note component gains an optional second action for this.
- On a new blank world, **Start Tour** runs the tour on that world. Anywhere else, it creates a new world with the same defaults as **New World** and opens it.
- **Start Authoring Tour** in Settings always creates a new world. It is its own row on the **Data** tab and shows in both Settings modes. It is not placed beside Reset Tutorials, which sits in Data → Storage and only shows in Advanced. The row is hidden while a game is running.
- **Rulings from ticket 10 (2026-09-23):**
  - The first-visit offer's body says "a new world", because it starts one. It keeps the same title and buttons as the new-world offer.
  - Any start of the tour retires the offers, including a start from Settings.
  - The in-game World Editor holds the first-visit offer. It is not spent, and it shows on the next editor visit from the main menu.
  - If the open world has unsaved edits, **Start Tour** shows the editor's Unsaved Changes dialog first. **Save** or **Discard** continues to the tour. **Cancel** keeps the world and leaves the offer on screen, unspent.
- **Rulings from ticket 05 (2026-09-23):**
  - The second location's example values (Appendix A) come from **Use Example** on the "Add a Second Location" step. It is offered only once the second location exists, and it fills that location's Name and both descriptions. The first add step has no **Use Example**, because the Name step follows it.
  - An add step detects its new item by comparing ids against the list as it stood when the step became current, so every add path counts.
  - A dev route to a mid-tour step replays each earlier step's add and example, so it opens on a filled step.
- **Rulings from ticket 07 (2026-09-23):**
  - The second Stats reader is titled "Stat Updates Prompt Reads", the app's own name for that prompt.
  - The narration reader shows the builder's real output, including the default descriptor. The step copy says only what stays true if the defaults change: narration never reads the number or the Description.
- **Ruling on the World Name step (user, 2026-09-23):** the untouched default name that **New World** gives a world does not count as a value. **Next** stays disabled until the author changes the name or uses **Use Example**. Ticket 14 builds it.
- **Ruling from ticket 06 (2026-09-23):** before the entity has a location, Player Sees shows its row and card as they will look, captioned "Players meet this entity once it has a location". This mirrors the AI readers' not-in-the-scene state, and it is the one wording on every entity step. The caption goes once the entity is placed.
- **Rulings from ticket 09 (2026-09-23):**
  - The test line reads "You ask {tour entity's name} about the {first keyword}.", or "You ask about the {first keyword}." when there is no named tour entity. It follows the first keyword until the author's first edit, then keeps the author's text for the session. It is never saved.
  - An entry that fires with an empty Value renders nothing, so the reader shows "The AI reads this entry once it has a Value". This is a fifth reader state.
  - When the scan does not fire the entry, the reader's text is the Activation Tester's near-miss reason when there is one, and "no keyword" only when the line holds no keyword.
  - The add step anchors on the Default book's **Add entry** button, because the tab's **+** adds a book.
  - The Name and Trigger Keywords step needs a Name and at least one keyword.

**Editor mode**
- The tour forces Simple through a mode override, the same kind the dev router uses. It never writes the stored preference, so the author's mode is back the moment the tour is off screen. There is nothing to restore.
- The Simple/Advanced toggle is disabled while the tour runs, with a tip that says why.

**Saving and resuming**
- The tour calls the editor's own Save after each completed step. The first step (World Name) makes a new world persistent.
- Progress lives in localStorage, keyed by world id: the current step and the tour item ids. Opening that world in the editor resumes at the stored step. Finishing or **End Tour** deletes the record. A record whose world no longer exists is pruned.
- **No world or save export-shape change.** All tour state is local.

**In Play**
- In Play computes one step's slice from the authored world: one **Player Sees** surface and a list of readers. Each reader is a prompt with its text, the marked spans of the author's text, and a state. The states are: reads, never reads, not in the scene (an entity with no location), and no keyword (a dictionary entry not matched by the test line).
- **Reads come from the Test Bench builders** (the AI Context and Opening instruments' data), with the shipped default prompts standing in for the global prompt settings. This is the Bench's own precedent. In Play never re-derives a context block.
- Readers per tab:

| Tab | Readers shown |
|---|---|
| Overview | Narration Prompt (world block) |
| Locations | Narration Prompt (location block). The Connection step shows Location Change Prompt (destinations list with the Travel Hint) and no Narration reader, because narration never reads destinations. |
| Entities | Narration Prompt (the roster of the entity's location) |
| Stats | Narration Prompt (the name and the current descriptor, never the number or Description) and Stat Updates Prompt (numbers and Description) |
| Traits | Narration Prompt (traits block, with the tour trait active) |
| Dictionary | Narration Prompt (dictionary block, driven by the test line) |

- **Marking** finds the field's current text inside the reader text and marks each match. Text the builder transforms beyond recognition is shown unmarked, not guessed at.
- **Dictionary test line.** It is prefilled from the entry's first keyword. Activation runs through the Activation Tester's scan, so In Play matches play.
- **Player Sees uses real game components.** Where a real component is bound to the running game's state or to a full-screen dialog, a presentational piece is extracted and the real screen renders that same piece. Known cases: the setup screen's trait list comes out of its full-screen dialog, and the Location tab body and the stat row render from props. **In Play never mounts a second game-state provider**, because one clears the running game's persona on mount. Nothing is a look-alike replica.
- Surfaces per tab: library card (World Name), Location tab (location fields and Connected Locations), a note that a new game starts here (Starting Location), entity list and entity card, stat row with its bar, setup-screen trait list with stat changes, and "the player never sees this" for Pronouns, the AI-Facing fields and dictionary entries.

**Placement**
- Desktop: In Play docks beside the editor. While the tour runs, it takes the Test Bench's dock slot. A docked or embedded Bench panel closes; the Bench popover stays available.
- Mobile: **Show Effect** opens In Play in a bottom sheet, the Test Bench's mobile pattern.

**Steps**
- About twenty steps in this order. Step boundaries are for the tickets to refine; the order and field set are settled.
  1. Overview: World Name, AI-Facing Description.
  2. Locations: add a location, Name, Player-Facing Description, AI-Facing Description, Starting Location, add a second location, Connection with Travel Hint.
  3. Entities: add an entity, Name, Pronouns, Player-Facing Description, AI-Facing Description, Locations.
  4. Stats: add a stat, Name with Min/Max/Initial Value, Description.
  5. Traits: add a trait, Name with Player-Facing Description, AI-Facing Description, a Stat Change.
  6. Dictionary: add an entry, Name, Trigger Keywords, Value, the test line.
  7. Ending: the Save button (pointed out once, after the first save), the Simple/Advanced toggle, then **Play** and the Test Bench flask.
- Step copy follows the UI help-copy pattern and the title-case rule for fragments.

**Example world**
- One fixed example world supplies every **Use Example** value. It uses a light transformation premise and stays SFW. Its text lives in the step registry. The approved text is in Appendix A.
- An example can mention things from earlier examples. If the author typed their own text earlier, a later example may not fit it. That is accepted.

**Dev tooling**
- A dev route opens the World Editor with the tour at a named step, so any step is one `goto` away. The dev-route drift guard covers it.

**Changelog**
- One In-Progress entry for the tour (👤), and one for the Overview relabel.

## Testing Decisions

- **What a good test is here:** it drives the editor the way an author does (click, type, Use Example, Next) and asserts what the author sees: the step note, the tour bar, In Play's text and marks, the saved world. No test reaches into the controller's state or the registry's internals.
- **One in-gate seam: the real World Editor, mounted through the existing World Editor Bench test harness.** Every tour behavior is tested here:
  - both offers appear, share a seen-state, and **No Thanks** retires both;
  - **Next** is disabled until the field has a value, and **Use Example** enables it;
  - add steps record the new item and select it; deleting a tour item makes its step current again;
  - In Play shows the right readers per tab, marks the author's text, says "never reads" where true, shows the name-only narration read for a stat, and adds and removes the dictionary entry as the test line changes;
  - the editor is in Simple during the tour, the stored mode preference is unchanged, and the toggle is disabled;
  - the world is saved after each step; a remount on the same world resumes at the stored step; **End Tour** clears it;
  - **drift check:** for every registry step, its anchor renders on its tab. This test iterates the registry, so a new step is covered with no new test.
- **One end-to-end spec**, outside the gates, walks New World → offer → every step with **Use Example** → **Play**, and checks that the game starts in the tour's starting location.
- Existing tests keep covering the relabel: the field-label and editor help-copy tests.
- **Prior art:** the World Editor Bench suites (the harness and its tests), the tutorial engine tests (including the main menu's multi-anchor tests), the dev-route drift guard, the AI Context and Opening instrument tests for play parity, and the enter-world end-to-end spec.
- **Guards must bite:** each drift and resume test is shown to fail with its bug put back before it counts.
- **Known trap:** a timed tutorial note over an open overlay takes Escape for one commit. A tour test that presses Escape must wait for the note to stand down first.

## Out of Scope

- **Try It** or any other AI call from the tour (ADR-0005).
- Advanced-only fields and the Placeholders tab.
- Fields outside the core set: Author, Tags, Thumbnail, music, 3D avatar, images, Regen, Body Sliders, trait toggles, match options and book fields. Their ⓘ tips stay as they are.
- A theme choice for examples, and examples that adapt to the author's own text.
- Release-time screenshots and a wiki walkthrough with images.
- Teaching the Test Bench's instruments beyond pointing at the flask.
- The library editors (entity, dictionary and prompt libraries).
- Renaming prompt chips.

## Further Notes

**Named during the grilling, not part of this spec:**
1. **Stale default descriptors (corrected 2026-09-23, awaiting the user).** Adding a stat in the editor gives it three descriptors built from its name at that moment: "New Stat is low / medium / high". A rename does not update them, and Simple mode cannot show or edit them. So narration reads `Sea Change: New Stat is low`, and the stat row shows the same text. An earlier version of this note said narration reads only the name, which was wrong. In Play shows the real output. The user chose a fix on 2026-09-23: untouched defaults follow a rename. It ships on `main` from its own spec, `docs-internal/specs/stat-descriptor-rename/`, and reaches this branch with the next merge from `main`. The tour needs no change for it.
2. Two docs are stale: the editor-mode module comment says Simple hides the Dictionary tab, and the Simple-mode design doc says Simple keeps the stat Enabled toggle. The code does neither.
3. The standalone trait-selection and starting-location modals are imported only by their own tests.
4. The project memory placed Reset Tutorials in "Settings → Accessibility → Help". It is in Settings → Data → Storage, and it only shows in Advanced.

**Domain terms:** Authoring Tour and In Play are in the glossary.

**Workspace**

The tour is a long effort and is not part of the next release, so it lives on its own branch.

| | |
|---|---|
| Branch | `feature/authoring-tour`, cut from `main` at the spec commit |
| Worktree | `.claude/worktrees/authoring-tour` (gitignored). `node_modules` is a junction to the main checkout's |
| Dev server | launch entry `authoring-tour`, port 5220 |
| End-to-end runs | `E2E_PORT=5221`, so Playwright never reuses another checkout's server on 5183 |

- The spec and tickets on this branch are the current ones. The copy on `main` only points here.
- Bring `main` into the branch regularly. Resolve conflicts on the branch, never on `main`.
- The branch merges to `main` only when the whole tour works and the user decides to ship it.
- Before removing the worktree, delete the `node_modules` junction first. `git worktree remove` follows the junction and deletes the main checkout's packages.

## Appendix A: Example world (approved 2026-09-23)

A cold-coast fishing village whose tide-fed spring slowly reshapes the people who bathe in it. Cozy and curious, never horror.

| Step | Example value |
|---|---|
| World Name | Brinewell |
| World AI-Facing Description | Brinewell is a quiet fishing village on a cold northern coast. At its heart lies the Tidewell, a stone spring that fills with seawater at high tide. Anyone who bathes in it slowly takes on traits of the sea: webbed fingers, gill lines, a scatter of scales. The villagers treat the change as ordinary and a little sacred. Outsiders find it unsettling. Keep the tone warm and curious, never horror. |
| Location 1 Name | The Tidewell |
| Location 1 Player-Facing | A ring of worn stone around a pool that rises and falls with the sea. |
| Location 1 AI-Facing | A round stone basin in the village square. Seawater floods in through a carved channel at high tide and drains away at low tide. Bathers feel a tingling warmth that lingers for hours. Shells and sea glass line the rim as offerings. |
| Location 1 | Starting Location |
| Location 2 Name | The Salt Lantern |
| Location 2 Player-Facing | The village inn, warm and smelling of peat smoke and fried fish. |
| Location 2 AI-Facing | A two-story inn on the harbor. The common room has a peat fire, long scarred tables, and a window that looks out on the Tidewell. Fishers gather here at dusk to trade gossip and tall tales. |
| Connection | The Tidewell ↔ The Salt Lantern, Travel Hint: down the lane past the net sheds |
| Entity Name | Maren |
| Entity Pronouns | she/her |
| Entity Player-Facing | The keeper of the Tidewell, with a warm laugh and faint silver scales along her jaw. |
| Entity AI-Facing | Maren tends the Tidewell and has bathed in it every week for twenty years. Silver scales now trace her jaw and forearms, and her fingers are lightly webbed. She is kind, nosy and fiercely protective of newcomers. She secretly fears the spring's pull on her is growing stronger. |
| Entity Locations | The Tidewell |
| Stat Name | Sea Change (Min 0, Max 100, Initial Value 0) |
| Stat Description | How far the Tidewell has reshaped your body. At 0 you are fully human. At 100 you belong to the sea. Raise it when the player bathes in the Tidewell or drinks its water. |
| Trait Name | Tide-Touched |
| Trait Player-Facing | You bathed in the Tidewell once as a child, and it remembers you. |
| Trait AI-Facing | The player bathed in the Tidewell as a child. Faint gill lines mark their neck, and they can breathe underwater for short stretches. Villagers greet them as one of their own. |
| Trait Stat Change | Sea Change +15 |
| Entry Name | The Drowned Bell |
| Entry Trigger Keywords | bell, drowned bell |
| Entry Value | A bronze bell that sank in the harbor long ago. Villagers say it rings beneath the water on the night before someone changes completely. |
| Test line | You ask Maren about the bell. |
