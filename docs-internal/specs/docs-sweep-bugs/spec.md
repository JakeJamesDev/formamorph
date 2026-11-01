# Spec: Docs Sweep Bugs

Status: done
Status note: Closed 2026-11-01, tickets 01–26, last landing ba93137c3. Review: spec text corrected, one gap fixed in 050354aa6. Ticket 26 (ba93137c3) fixed the one red test from the close; a full run on main then passed it.
Spec session: docs-sweep-bugs — spec

## Problem Statement

The docs sweep checked every wiki page against the code. Where the code looked wrong, the sweep wrote the page to match the code and named the bug (docs-sweep Q16). Sixteen of those bugs remain in the app. A player or author meets each one as a control that does nothing, a label that is false, a file that won't import, or work that is lost.

## Solution

Fix each bug in its own ticket. Each ticket ships a test that fails while the bug is present, a changelog fragment, and the docs sentence that Q16 removed or bent, written again to the fixed behavior.

Every bug was confirmed in source on 2026-10-31. Tickets 06 and 02 were not run: ticket 06 reproduces its bug first in a test, and ticket 02 needs a Mac to see live.

## Rulings

Settled with the user on 2026-11-01.

| # | Ruling |
|---|---|
| Q1 | One ticket per bug. Only ticket 02 waits, on ticket 01, which owns the update phase → dialog title function both edit |
| Q2 | Each ticket ships a red-then-green test, a changelog fragment, and its docs update. A ticket with no user-facing change writes a 🛠️ fragment |
| Q3 | **Reset All My Changes** keeps the memories the player wrote by hand (ticket 04) |
| Q4 | The entity **Avatar** dropdown shows in Simple mode too (ticket 10) |
| Q5 | The Custom Persona keeps its Others/Self switch. Its Others openings carry a mark that they never draw (ticket 11) |
| Q6 | The Test Bench Opening tab hides the **at** pick and keeps its own **Starting Location** pick (ticket 16) |
| Q7 | On a Mac, the footer returns to the update-available state once the `.dmg` opens. The update dialog says the file opened in the browser (ticket 02) |
| Q8 | The hidden `#load-world` input, its handler and its test are removed. No Load World button returns (ticket 12) |
| Q9 | Scripts see only named dictionary entries, the rule entities already follow (ticket 15) |
| Q10 | A Group made by a tile drop takes the next free name (New Group, New Group 2, …). One shared name check serves **Create New Group**, the drop and Rename, so Rename also refuses a duplicate (ticket 03) |
| Q11 | Tests sit at the highest existing seam. Two new seams: a pure update phase → dialog title function (ticket 01) and an injected seed on the stat-code executor (ticket 14) |
| Q12 | A Replace All never leaves two Tools with one name. The name check counts names the pass already wrote (ticket 17) |
| Q13 | In Simple mode, an item script hit drops, because the item's Scripts tab is hidden (ticket 18) |
| Q14 | **Reset All My Changes** keeps lines from a script's `memories.pin()` too. They work like hand-written memories |
| Q15 | A Persona-Only entity's Others openings get the Custom Persona treatment: **Never Draws**, a dash, out of the view's pool (ticket 19). They never draw, picked or not, so the mark takes no pick condition. Ticket 11's other rulings carry over, and its false "Joins the world's openings" hint is replaced here too |
| Q16 | The Openings checkbox and the panel's footer hint count only rows the game can draw (ticket 20) |
| Q17 | A Group rename to a taken name shows the Group picker's error line under the field (ticket 21) |
| Q18 | A name that holds only spaces is blank, for entities and dictionary entries alike (ticket 22). The check is `name.trim() === ''`, and locations follow it, since they share the check. The editor's name menus and bracket completion follow it too |
| Q19 | **Optimize Images** scans and applies item images (ticket 23). They join the one optimize list, so every flow that reads it follows, and the Test Bench rule opens Items for them. The Media gallery gains no item section. Item copies have no image field, so that clause needs no code. The `image-not-webp` and `image-mislabeled` Fixes reach item images too |
| Q20 | A single skipped Tool name Replace names its reason from the Save Tool check. Replace All keeps its count (ticket 24) |
| Q21 | A website download of a bad preset listing says "listing", not "file". The app's file import keeps its text (ticket 25). This ticket adds no changelog fragment: ticket 05's unreleased entry covers the preset download |

## The bugs

| Ticket | Docs-sweep ticket | Bug | Fix |
|---|---|---|---|
| 01 | 01 | The update dialog title reads **You're up to date** while a download runs or waits | Title per phase |
| 02 | 01 | On a Mac, **Download** opens the `.dmg` but the footer sits at a 0% bar until the next check | Q7 |
| 03 | 01 | A tile drop names its Group *New Group* with no unique-name check | Q10 |
| 04 | 03 | **Reset All My Changes** deletes hand-written memories | Q3 |
| 05 | 05 | On formamorph.ai, a prompt preset or Mascot device download saves a dictionary-shaped `.json` that no importer reads | Each kind downloads in its own file format |
| 06 | 05 | A world whose only persona is a Custom Persona may skip **Enter World** and never offer **Name** | The Custom Persona counts as a persona choice |
| 07 | 07 | **Search World** skips the Items, Scripts, Tools and Media tabs | Search the text those tabs hold |
| 08 | 07 | **Optimize Images** drops its Map Background results | Apply the map results |
| 09 | 07 | Entity card import loses the **Self** mark on openings | Carry the mark |
| 10 | 07 | Simple mode offers **Upload Avatar…** but hides the **Avatar** dropdown | Q4 |
| 11 | 07 | The Custom Persona's Others openings never draw, with no sign of it | Q5 |
| 12 | 07 | The hidden `#load-world` input has nothing that opens it | Q8 |
| 13 | 11 | The 🔗 row marker never shows **Link pending save** | Pass the pending links to the marker |
| 14 | 13 | `Math.random` gets a fresh seed only on Tool runs | Seed every run |
| 15 | 15 | Unnamed dictionary entries all get the script key `""` and collide | Q9 |
| 16 | 15 | The Test Bench Opening tab shows the **at** pick but ignores it | Q6 |

## User Stories

1. As a Mac player, I want the footer to leave the progress bar once the `.dmg` opens, so that the app does not look stuck on a download it isn't running.
2. As a Mac player, I want the update dialog to say the file opened in my browser, so that I know where the update went.
3. As a desktop player, I want the update dialog title to name the update while it downloads, so that the dialog doesn't tell me I'm up to date when I'm not.
4. As a desktop player, I want the dialog title to show the downloaded state, so that I know **Update & Restart** is ready.
5. As a player organizing my Library, I want a tile drop to name its new Group so it doesn't repeat a name, so that I can tell my Groups apart.
6. As a player, I want Rename to refuse a Group name that is taken, so that the same rule holds everywhere a Group gets a name.
7. As a player, I want **Reset All My Changes** to keep the memories I wrote myself, so that a reset of the story's ledger doesn't lose my own notes.
8. As a player, I want the reset confirmation to say my hand-written memories stay, so that I can reset without fear.
9. As a website visitor, I want a prompt preset device download to save a preset file, so that the app's preset import reads it.
10. As a website visitor, I want a Mascot device download to save a Mascot card, so that Formaquestion's Mascot import reads it.
11. As a player, I want a world whose one persona is a Custom Persona to open **Enter World**, so that I can type my **Name** and **Description**.
12. As an author, I want **Search World** to find text on the Items tab, so that I can find an item by its description.
13. As an author, I want **Search World** to find text in my Scripts, so that I can find where a script reads a stat.
14. As an author, I want **Search World** to find text in my Tools, so that I can find a Tool by its description.
15. As an author, I want a search hit on these tabs to open the row it matched, as hits on other tabs do.
16. As an author, I want **Optimize Images** to apply its Map Background results, so that the map images it counted are the ones it keeps.
17. As an author, I want an entity card to bring back each opening's Self mark, so that a persona's own start stays its own start.
18. As an author in Simple mode, I want the **Avatar** dropdown on an entity, so that I can use the Avatar I just uploaded.
19. As an author, I want an Others opening on the Custom Persona to say it never draws, so that I don't write openings no player will see.
20. As a maintainer, I want the unreachable `#load-world` input gone, so that no test covers a path no user can reach.
21. As an author, I want the 🔗 marker on a linked row to say **Link pending save** before I save, so that the row and the footer agree.
22. As an author, I want two dice stats in one turn to roll apart, so that a random stat is random.
23. As an author, I want scripts to skip unnamed dictionary entries, so that two blank names never fight over one key.
24. As an author, I want the Test Bench Opening tab to show only the controls it reads, so that I don't pick a location it ignores.
25. As a wiki reader, I want each page to describe the fixed behavior, so that the docs and the app agree again.

## Implementation Decisions

- **Update state (tickets 01, 02).** The desktop download call tells the renderer when the download went to the browser. The renderer uses that answer, not a platform guess, to return to the available state (Q7). An opened-in-browser flag shows the dialog line; it clears on a new download, a channel change, or a check that finds a different version or nothing newer. An answer that arrives outside the downloading phase is ignored. Download stays and opens the `.dmg` again. The update dialog takes its title from one pure phase → title function. Downloading and downloaded phases get their own titles, and the new-version notes marker stays during them. In those phases the dialog hides **Check for updates** and offers Close only. The title copy follows the Writing Guide.
- **Group names (ticket 03).** One name-taken check, trimmed and case-insensitive, lives with the library organization operations. The Group picker, Group creation and Rename all use it. A tile drop picks the first free name in the series New Group, New Group 2, New Group 3. The operations' comment about drag gestures is made true. The library-drag-parity spec's R10 contradicts the drop and gets a note, not an edit to a closed ruling.
- **Memories reset (ticket 04).** Reset clears edits, deletions and pins, and keeps the hand-written memory list. Reset enables only when an edit, deletion or pin exists; hand-written memories alone leave it disabled. The confirmation text, the Memories help topic and the Memory page change with it (Q3).
- **Device downloads (ticket 05).** The device download has a branch per catalog kind. A prompt preset saves the share file the app's own preset export writes, with its `.preset.json` name. A Mascot saves the WebP card the Mascot export writes: the card data embedded in the Initial look. A listing with no kind stays a world; an unknown kind fails loudly instead of falling through to the dictionary file. The Mascot file is `<name>.webp`, its Initial look rendered from the card's own images, never the listing thumbnail.
- **Enter World (ticket 06).** The enter-flow input gains a Custom Persona flag, so a world whose one persona choice is the Custom Persona opens the persona step. The ticket's first step reproduces the skip in a component test; if the skip doesn't happen, the ticket stops and reports.
- **Search World (ticket 07).** The search sources gain items, scripts and tools. Items search their names, descriptions, unidentified name and description, and image tags. Scripts search their name and code. Tools search their name, description and parameter descriptions. Media holds no text of its own and stays out; the docs say so. Each new hit opens its row through the editor's existing search-target navigation. Scripts means every Scripts-tab row; item scripts join as Items hits, opening the item's Scripts panel tab through a find hint this effort added. The new fields take Replace through their normal writers, Tool names included; a Tool name Replace that fails the Save Tool draft's name checks counts as skipped, judged against the names the pass has already written (Q12). Mode filters by tab only, as on the other tabs, except that an item script hit drops in Simple mode, where its tab is hidden (Q13).
- **Optimize Images (ticket 08).** The apply step copies the Map Background back with the thumbnail, inside the same **Optimize Images** history Step.
- **Card openings (ticket 09).** The card opening reader keeps `self: true` when the row carries it. No export-shape change: export already writes the field.
- **Simple mode Avatar (ticket 10).** The entity **Avatar** dropdown drops its Advanced-only gate. The Simple/Advanced upload tests that lock in the current split change on purpose (Q4).
- **Custom Persona openings (ticket 11).** The Openings panel marks each Others row on the Custom Persona entity, and the world openings view drops its draw chance for those rows. The switch stays (Q5). Those rows leave the view's pool, show a dash on the entity's Openings tab too, get no **No Starting Location** badge, and hide when a start is picked. The mark reuses the existing Badge + Tip, and its copy follows the Writing Guide. The same gap on an unpicked Persona-Only entity is out of scope and named in the ticket's Landed. The panel hint that says the entity's openings join at its locations is made true for the Custom Persona.
- **Dead input (ticket 12).** The input, its handler and its direct-fire test are deleted (Q8). A pure deletion has no behavior left to test, and no docs page named the input, so this ticket ships neither a red test nor a docs edit.
- **Pending links (ticket 13).** The World Editor passes the linking hook's pending list down to every 🔗 marker: the dictionary tree, the entity tree and the entities adapter. The marker takes the list as a prop and calls the existing status-line function with it.
- **Random seed (ticket 14).** The executor seeds `Math.random` from `crypto.getRandomValues` on every run, read-only or not. The seed source is injectable for the test (Q11).
- **Unnamed entries (ticket 15).** The named-entries builder skips entries with a blank name, for the script map, the write-back and the code cards. Toggles stay keyed by entry id.
- **Opening lens (ticket 16).** The bench tab table names which lens parts each tab reads. The lens bar draws only those parts. Opening reads the PC part only (Q6). The Test-Bench page already read right, so this ticket ships no docs edit.

## Testing Decisions

- A good test drives the behavior a player or author sees, through the public seam, and fails when the bug returns. Each ticket proves its test red against the bug before the fix (the test-bar skill). No test shapes a fixture so the bug can't fire.
- Pure seams: the update reducer and the new phase → title function (01, 02), the library organization operations (03), the enter-flow builder (06), world search (07), the entity card round trip (09), the openings pool and editor view (11), the stat-code executor with an injected seed (14), the named-entries builder (15), the bench tab table (16).
- Component seams (jsdom): the update checker hook with a fake desktop bridge (02), the Memories dialog (04), the device-download hook with preset and Mascot listings (05), Enter World for the red reproduction (06), the World Editor optimize suite (08), the World Editor Avatar and entity panel suites in both modes (10), the Openings panel (11), the World Editor library-links suite (13), the Test Bench (16).
- Prior art: the existing tests beside each module. The docs tests (`src/lib/docs`) stay green on every docs edit.

## Out of Scope

- Running the Mac update path on a Mac. The ticket proves it through the fake bridge.
- The two server settings and image generation default the docs sweep ruled intended.
- Released changelog sections, which stay history (the Load World note included).

## Further Notes

- Docs-sweep evidence for each bug: the "Landed" sections in `docs-internal/specs/docs-sweep/issues/`.
- Edited docs sections leave their help vectors stale until a close rebuild, as in the docs sweep (its Q7).
