# Large-World Performance and Crash Safeguards — Spec

Status: ready-for-agent
Spec session: large-world-performance — spec
Status note: (2026-10-06) Grilled; rulings Q1–Q24 below. Ticket 01 (diagnosis) can revise the Q1/Q8 bar.

## Problem Statement

Players report lag and crashes when they edit large worlds in the World Editor. Large means hundreds of entities and locations, many images, and one location holding many children. The developer's PC is too fast to show the problem.

A profiling harness (`npm run profile:editor-speed`) loads a generated 126 MB world (400 entities, 300 locations with 150 under one parent, 475 images) into a production build at 6x CPU slowdown. The baseline:

| Step | Wall time | Main thread blocked | Worst block | Heap after GC |
|---|---|---|---|---|
| Open the editor | 2.4 s visible, 5.1 s settled | 2.9 s | 2.0 s | 823 MB |
| Type 26 keys into Name | 130 s | — | 21–22 s | 2.6 GB peak |
| Drag a tree row | frames p95 367 ms, max 1.7 s | 14.5 s | 1.65 s | 993 MB |
| Open the Locations Canvas | 32.7 s | 32.6 s | 23.3 s | 1236 MB |
| Drag a canvas node | max frame 717 ms | 2.1 s | 0.5 s | 1236 MB |
| Save | 11.1 s | 11.6 s | 2.7 s | 1491 MB |

The canvas draws 23,100 Implicit Navigation edges (every sibling pair, both directions) and 117k DOM nodes. The heap reaches 823 MB once the editor is open, holding the world about five times over (ticket 01). When anything throws, the whole app goes blank: there is no error boundary, no global error handler, and a save that fails on full storage can hang with no message.

## Solution

- The editor stays responsive on large worlds on an average machine: no single freeze over one second, and smooth drags.
- Memory stays bounded: the Main Menu no longer holds every world, and editing a large world peaks under 1 GB.
- The Locations Canvas and the in-play Map draw Implicit Navigation only where the author or player is looking, not as a full mesh.
- A crash in one editor panel shows a card in that panel. The rest of the editor keeps working, and edits are kept.
- A crash of the whole app shows a recovery screen that can export unsaved world edits.
- A save that fails because storage is full says so, shows the space used and available, and offers Export World.
- Desktop and Android recover from a renderer that runs out of memory instead of showing a dead window.
- Nothing changes in the look or behavior of pickers, trees, or fields.

## Rulings

| # | Ruling |
|---|---|
| Q1 | Bar on the bench world at 6x CPU: no main-thread block over 1 s in any harness step; drag frames p95 under 100 ms. |
| Q2 | Locations Canvas: sibling Implicit Navigation edges show only for the focused node. Clicking a shown dashed edge still authors a Connection. |
| Q3 | Error boundaries at the app root and on each World Editor panel. |
| Q4 | A save that fails on full storage names the error, shows used and available space, and offers Export World. |
| Q5 | Out of scope: moving media out of the world object into a blob store. That is its own effort. |
| Q6 | The world library database moves to version 2 with a separate metadata store, filled once from existing records. |
| Q7 | The editor-speed harness stays outside the four gates. Each ticket reports before and after numbers. |
| Q8 | Main Menu heap no longer grows with library size. Editor peak on the bench world stays at or under 1 GB through save. |
| Q9 | Withdrawn. The canvas never draws child-to-parent edges; containment is the frame. |
| Q10 | Root crash screen actions: Reload, Copy Error Details, and Export World when unsaved edits exist. |
| Q11 | Unhandled promise rejections and window errors: console log plus a throttled error toast with View Details. |
| Q12 | Out of scope: a crash-recovery draft of unsaved edits. |
| Q13 | The four location and persona Select pickers memoize their option lists. No visible change. A harness step measures them; further work only if they miss Q1. |
| Q14 | Out of scope: a warning for heavy worlds. |
| Q15 | Panel crash card, approved from a mock: warning icon, title "This Panel Stopped Working", line "Your unsaved edits are kept. Try again, or view the details to report the problem.", buttons View Details (opens the existing Error Details dialog) and Try Again (remounts the panel). |
| Q16 | Accepted: an older build in the same browser can no longer open the library after the version 2 upgrade. |
| Q17 | Crash causes go first. |
| Q18 | Root crash screen, approved from a mock: same composition as the panel card, full screen, title "Formamorph Stopped Working". |
| Q19 | Ticket 01 diagnoses before the bar locks: Main Menu heap snapshot with retainers, bare IndexedDB get and put of the bench world at 6x, and an empty-library control run. Q1 and Q8 stand unless that evidence shows a floor; then the bar goes back to the user. |
| Q20 | "Focused" on the canvas = hovered or selected. A selected node keeps its edges after the detail panel closes, so touch can author. A multi-select shows the union. Edges hide during a drag. |
| Q21 | Platform guards: Electron reloads a renderer that dies or runs out of memory, with a message. Android raises the WebView heap ceiling. No persistent-storage request. |
| Q22 | Root Export World reads a plain module reference to the last world the data provider committed. No copy is made. The button is hidden when no world is held. |
| Q23 | In-play Map: Implicit Navigation edges show from the player's current location, plus the hovered node on desktop. |
| Q24 | Test seams as listed under Testing Decisions. No new seams. |
| Q25 | Pin load joins this effort as tickets 17 and 18. On the pin world (`--pins 1`: one placeholder pinned 551 times, sources pinning 200 each), the pin-conflict check made each rules pass 16 s at 1x and the pinned placeholder never opened. |

## User Stories

1. As an author of a large world, I want the World Editor to open without a long freeze, so that I can start editing right away.
2. As an author, I want typing in any field to stay instant on a large world, so that writing feels normal.
3. As an author, I want to drag entities, locations, traits and placeholders in their trees without stutter, so that reorganizing a big world is practical.
4. As an author, I want the Locations Canvas to open in seconds on a world with hundreds of locations, so that I can use it at all.
5. As an author, I want the canvas to show a location's Implicit Navigation when I hover or select it, so that I can see where it leads without a wall of lines.
6. As an author, I want to click a dashed implicit edge of the focused location to author a Connection, so that the existing authoring gesture still works.
7. As an author on a touch device, I want a selected location to keep showing its implicit edges after the detail panel closes, so that I can author Connections without hover.
8. As an author, I want a multi-selection to show every selected location's implicit edges, so that I can compare several at once.
9. As an author, I want implicit edges to hide while I drag, so that the drag stays smooth.
10. As an author, I want dragging a location on the canvas to stay smooth on large maps, so that layout work is practical.
11. As an author, I want Connection arrows to keep replacing their pair's implicit link on the canvas, so that one-way travel stays visible (ADR-0002).
12. As a player, I want the Map to show where I can go from my current location, so that it reads at a glance.
13. As a player on desktop, I want hovering a Map location to show its implicit edges, so that I can plan a route.
14. As a player of a large world, I want the Map to open without freezing play, so that travel stays responsive.
15. As an author, I want saving a large world to finish without a long freeze, so that saving often is painless.
16. As an author, I want the Main Menu to stay light no matter how many large worlds are in my library, so that the app does not slow down as my library grows.
17. As an author, I want the library list to load without reading every world in full, so that the menu opens fast.
18. As an author, I want the library to upgrade itself once to the new storage layout, so that I don't have to do anything.
19. As an author, I want backup and restore to keep working after the upgrade, so that my backups stay valid.
20. As an author, I want a restored backup to show correctly in the library, so that names, thumbnails and tags match the restored worlds.
21. As an author, I want a save that fails because storage is full to say so, so that I know why it failed.
22. As an author, I want that message to show how much space is used and available, so that I can decide what to free.
23. As an author, I want that message to offer Export World, so that I don't lose the work I couldn't save.
24. As an author, I want a save never to hang without a result, so that I'm never left guessing.
25. As an author, I want a failed save to leave the world and its library copies consistent, so that a retry doesn't double-write or desync them.
26. As an author, I want a crash in one editor panel to show a card in that panel only, so that I can keep working elsewhere.
27. As an author, I want Try Again on that card to bring the panel back, so that a one-off error doesn't cost me the session.
28. As an author, I want View Details on that card to open the Error Details dialog, so that I can copy the error or report a bug.
29. As an author, I want my unsaved edits kept when a panel crashes, so that nothing is lost.
30. As a user, I want a crash of the whole app to show a recovery screen instead of a blank page, so that I know what happened.
31. As an author, I want that screen to export my unsaved world when I had unsaved edits, so that I can recover my work before reloading.
32. As a user, I want Copy Error Details on that screen, so that I can report the crash.
33. As a user, I want Reload on that screen, so that I can continue.
34. As a user, I want errors that happen outside React to show a short error toast, so that silent failures become visible.
35. As a user, I want those toasts throttled and deduplicated, so that a repeating error doesn't flood the screen.
36. As a user, I want harmless browser noise (resize-observer loops, canceled requests, cross-origin script errors) ignored, so that I only see real problems.
37. As a desktop user, I want the app to reload itself with a message when its window runs out of memory, so that I'm not left with a dead window.
38. As an Android user, I want the app to have more memory to work with, so that large worlds don't kill it.
39. As an author, I want the location and persona pickers to look and work exactly as before, so that nothing I know changes.
40. As an author, I want those pickers not to slow down typing elsewhere in the editor, so that large location lists cost nothing until I use them.
41. As an author, I want importing a large world from the Main Menu not to freeze the app, so that import feels safe.
42. As an author, I want publishing a large world not to freeze the editor while it measures and builds the upload, so that I can keep working.
43. As a developer, I want a harness that measures the editor on a large world under CPU throttle, so that every fix has before and after numbers.
44. As a developer, I want the harness to cover pickers too, so that Q13 can be checked.
45. As a developer, I want the heap and IndexedDB floors measured before the bar locks, so that we don't chase a target the storage layer can't reach.
46. As an author, I want a placeholder pinned from hundreds of sources to open and edit without freezing, so that heavy pin use stays practical.
47. As an author, I want a trait or location that pins hundreds of placeholders to open its Pins tab quickly, so that I can manage its pins.
48. As an author, I want editing anything in a heavily pinned world to stay responsive, so that the pin-conflict check never blocks typing.

## Implementation Decisions

### Ticket order

Tickets live in `issues/`. Blocking edges are on each ticket.

| # | Ticket | Rulings |
|---|---|---|
| 01 | Diagnose the bar | Q19. Reports before 13 locks its target. |
| 02 | Neighbor lookup for Implicit Navigation | Prefactor for 03 and 04. |
| 03 | Focus-only implicit edges on the canvas | Q2, Q20 |
| 04 | Current-location edges on the Map | Q23 |
| 05 | Library metadata store | Q6, Q16 |
| 06 | Full-storage save errors | Q4 |
| 07 | Root crash screen and global handlers | Q10, Q11, Q18, Q22 |
| 08 | Panel crash card | Q3, Q15 |
| 09 | Platform out-of-memory guards | Q21 |
| 10 | Canvas drag session | |
| 11 | Tree row memoization | |
| 12 | Tree virtualization | |
| 13 | Save, load and dirty-check copies | Q8 |
| 14 | Split the data context | |
| 15 | Picker memoization and harness step | Q13 |
| 16 | Worker moves | |
| 17 | Pin conflicts once per target | Q25 |
| 18 | Pin row display names | Q25 |

### Canvas and Map (tickets 02–04)

- The canvas graph builder stops emitting sibling Implicit Navigation edges for the whole world. It emits edges for a given set of focused locations only. With no focus, it emits none.
- Focus on the canvas follows Q20. Focus on the Map follows Q23.
- Every other caller that enumerates implicit pairs (reachability from starting locations, effective destinations in play, world migration) moves to per-location neighbor lookup: parent, children and siblings computed from a parent index, never from an enumerated pair list. Gameplay behavior is unchanged.
- ADR-0002 holds: an overridden pair draws its Connection arrows, never an implicit edge, focused or not.
- Viewport culling is turned on for the canvas and the Map.

### Library metadata store (ticket 05)

- The world library database goes to version 2. Version 2 adds a metadata store keyed by world id holding the record's list fields (name, description, author, thumbnail, tags, source link fields, dirty, timestamps). World data stays in the existing store.
- The upgrade fills the metadata store with a cursor inside the upgrade transaction, one record at a time.
- The upgrade handles a blocked upgrade (another tab open on version 1) with a visible message, and the service closes its connection on a version change.
- Every write path that touches the world store writes the matching metadata in the same transaction: store, content update, listing link, delete, default-world seeding, backup restore, and the dev and harness seed paths.
- Backup and restore open the database at the current version, not a fixed one, and restore writes metadata beside each world.
- The world list, the load-game dialog, and the editor's world-change refresh read the metadata store only. Lookups that need world data by id use a keyed get. Whole-store reads of world data used for publish linking and linked copies move to metadata or keyed reads.
- **Storage shape note:** IndexedDB layout only. World and save export files do not change.

### Full-storage handling (ticket 06)

- Every library write listens for the transaction's abort and error, and rejects with the underlying error object.
- The data provider's save returns the error to its callers instead of a boolean. The World Editor save button, the in-play editor's exit prompt, and the Authoring Tour handle it.
- A quota error is recognized by name and shown with used and available space from the storage estimate, and an Export World action. Other failures keep a general message with View Details.
- Library copies of owned items are written in the same transaction as the world, or after it succeeds, so a failed save leaves both unchanged.

### Crash safeguards (tickets 07–09)

- A root boundary wraps the app above the data provider. Its screen follows Q18 and Q10. Export World reads the last-committed world through a plain module reference the provider sets on each commit (Q22). Copy Error Details copies the error and component stack as text, since the Error Details dialog's host is gone.
- Each World Editor panel (tab body, detail panel, Locations Canvas, Test Bench) gets a panel boundary showing the Q15 card. Try Again remounts the panel. Edits live in the provider, so they survive.
- The panel card is a new Design-System pattern, approved from a mock (Q15). It joins the design-system reference with the ticket.
- Global handlers log every unhandled rejection and window error. They toast through the existing error toast with View Details. Toasts are deduplicated by message, throttled to one per message per window, and capped per session. An ignore list drops resize-observer loop notices, opaque cross-origin script errors, abort errors from unmount cancels, and errors from browser extensions.
- Electron listens for the renderer dying or becoming unresponsive, shows a native message, and reloads the window.
- Android raises the WebView heap ceiling in the app manifest.

### Canvas drag (ticket 10)

- The drag session built at drag start also holds each location's descendant set and a has-children set. Per-move hit tests read those sets, so a pointer move costs O(N), not O(N²).
- The drop-target context value changes only when the drop target changes, not on every frame.

### Trees (tickets 11–12)

- The shared sortable tree memoizes its visible-row list per surface and renders rows through a memoized row component with stable callbacks.
- The drag-move handler updates the projected depth only when the depth changes.
- Rows share one placeholder vocabulary per render through context instead of building it per row.
- The tree virtualizes its rows with no visible change. The dragged row and its drop neighborhood stay mounted while dragging. ADR-0007 holds: the drag layer, stable items, hover suppression, translate-only rows, and no bounding clamp on X for depth-nesting trees.

### Save, load and dirty check (ticket 13)

- The dirty check compares only records whose identity changed since the last commit against the saved baseline. No whole-world string is built per edit.
- The saved baseline is kept as one structure, not a snapshot string plus a parsed copy plus a canonical string.
- Discard rebuilds from that baseline.
- Load and save each make at most one full copy of the world beyond the live one.

### Context split (ticket 14)

- The data context splits stable actions from state, so components that only call actions don't re-render on edits.
- Per-keystroke whole-world passes (placement letters, Blueprint copy sync, the advanced-features scan) cache by record identity or run only for changed records.

### Pickers (ticket 15)

- The four Select pickers that list locations or personas memoize their options and items on the lists they depend on (Q13). No change to look, positioning, typeahead or keyboard behavior.
- The harness gains a picker step.

### Worker moves (ticket 16)

- Main Menu world import parses and migrates in the existing JSON worker, as the World Editor import already does.
- Publish measures and builds its payload in a worker.

## Testing Decisions

- A good test checks behavior through a public seam: what the author sees, what storage holds, what a function returns. Never internal call counts or render counts.
- **Perf bar:** the editor-speed harness. Each ticket reports its steps before and after at 6x. Outside the gates (Q7).
- **Pure library tests** on the canvas graph (focused edge sets, overrides per ADR-0002, Map current-location edges, neighbor lookup parity with the old pair enumeration), the drag session, and the dirty compare (dirty after edit, clean after revert, clean after save). Prior art: the existing location canvas, location graph and canonical-stringify tests.
- **Storage tests** on fake-indexeddb: version 1 to 2 upgrade fills metadata; every write path keeps metadata in sync; a quota abort rejects with the error; a failed save leaves world and copies unchanged; backup and restore at version 2. Prior art: the existing storage-service and backup tests.
- **World Editor Bench** for boundaries (a throwing panel shows the card, the rest works, Try Again remounts, edits survive) and save errors (quota message with Export World). Prior art: the World Editor bench suites.
- **E2E** for the canvas: selecting a location then clicking its dashed edge authors a Connection; touch-width selection keeps edges. The existing canvas specs that click implicit edges select a node first. Prior art: the location canvas e2e spec.
- Each guard is proven to bite by reinstating the old behavior once.

## Out of Scope

- Moving media out of the world object (Q5). This is the largest remaining memory lever and the next effort.
- A crash-recovery draft of unsaved edits (Q12).
- A heavy-world warning (Q14).
- A persistent-storage request (Q21).
- Visual or behavior changes to pickers, trees or fields.
- Turning the harness into a gate (Q7).

## Further Notes

- Harness: `npm run profile:editor-speed`; world generator `node testing/editor-speed/genLargeWorld.mjs` (flags for every size).
- Ticket 01 findings (2026-10-06): Q1 and Q8 stand. The 823 MB in the baseline is the heap after open; the Main Menu holds 70 MB (27 MB empty, 67 MB with the defaults only). At 6x, a bare IndexedDB `get` of the bench world blocks 0.33–0.36 s and a bare `put` 0.76–0.81 s. `storeWorld` reads the old record before its put in one task and blocks 1.1 s, so the save path must drop that read. The open-editor heap holds the world about five times: live, `savedSnapshot`, `savedCanonical`, and ~355 MB of dirty-check canonical cache. After save, stale closures keep a second generation of each copy, about 970 MB of serialized strings in all. Ticket 13 owns those copies. Full numbers are in ticket 01.
- The Test Bench rules took 112 ms unthrottled on the bench world (about 670 ms at 6x) and run after each typing pause. They didn't show as long blocks in the baseline run; ticket 14 re-measures.
