# Spec: Script Surface

Status: done
Status note: Closed on 2026-10-21. Tickets 01–15 done; the last landing is 9b2f1fc2b. Review: spec text corrected (Q60, the Migrations table, the turn row) and one Tools guide row fixed in the close. Gates on 2026-10-21: lint red on one error in a gitignored worlds-wip file outside the effort; test 26892 passed with one failure, the guide test pinning the corrected row, fixed in the close and green on rerun.
Spec session: script-surface — spec

## Problem Statement

A script can move the player but cannot see the world's locations: `location` is one object with an id, a name and `move`, and no `locations` global exists. A script can add to the story's memory but cannot read it: `memory` is two functions over a ledger the Memory panel already shows row by row, and its `pin` makes an always-sent line while the panel's **Pin** marks a digest to keep. `diary` is a bare function that takes an entity name, while every other entity action sits on the entity's entry. The Variable menu wraps those bare functions in groups with one item. Script authors meet a second, older surface in a user Tool, with `world.entities` as an array and `scene.present` as names, so the same world reads two ways. A player-toggled trait switch drops its memory and diary writes.

## Solution

The surface follows one pattern: a map by name for every kind of authored thing, and a current entry with the same shape where play has one. `locations` is the map and `location` is the current entry with `move`. Entity entries gain `location`, `following` and `diary`. `memories` is an array of the ledger's rows, each with its turn, its story-clock stamps and its standing verdict, and with the panel's actions as verbs. `memories.add` and `memories.pin` keep their meanings. `dictionaries` entries gain their book's entries. World Tool scripts read the same surface already; user Tool scripts converge on it read-only, and `world` and `scene` dissolve. Script text migrates on load, so no alias remains. The Variable menu draws a one-item group as a leaf, and hover cards follow an array element.

## Rulings

Settled with the user on 2026-10-21. R rulings came from the design discussion; Q rulings from the grill. Q25 is superseded by Q27; Q22 and Q23 are refined by Q24. R7 to R9 were added after the first twelve tickets landed, as tickets 13 to 15.

| # | Ruling |
|---|---|
| R1 | `locations` is a map of the world's locations by name, as `entities` is. `location` is the current entry plus `move`, the `owner` to `entities` relationship. `location.move` stays; no `player.move`, since naming `player` moves a script onto the async engine |
| R2 | `diary` moves onto entity entries: `entities.Mira.diary(line)` beside `move` and `follow`. The top-level `diary` goes |
| R3 | `discover` stays a top-level function. The Variable menu draws a group with one child as a leaf, a general rule |
| R4 | `memories` is an array of the Memory panel's rows, oldest first. Memories have order and no author name, so an array, not a map |
| R5 | `memories.add(line)` keeps today's `memory.add`: a line on this turn's digest, judged like any digest. `memories.pin(line)` keeps today's `memory.pin`: a line that rides every request, shown under Custom. The verb is `pin` in both places; the guide says a pinned digest can still lose on the band cap while a pinned line never does |
| R6 | An entry's time is `timestamp`, a number: story hours at that turn, the scale of `clock.elapsedHours`, never a formatted stamp. `day` and `daypart` sit beside it, flat, since a script cannot derive a daypart without the world's calendar |
| Q1 | Script text migrates on world load: `memory.add` to `memories.add`, `memory.pin` to `memories.pin`, `diary(x, line)` to `entities[x].diary(line)`, dotted when `x` is a plain name literal. Idempotent. No runtime alias. A world exported after load carries the new form |
| Q2 | An entry's standing verdict reads as two booleans, `pinned` and `forgotten` |
| Q3 | Entry writes: `pin()`, `forget()`, `edit(text)`, `remove()`. `remove` is the panel's delete: tombstoned, out of context, restorable from the panel |
| Q4 | The array holds the live digests and the Custom lines, flagged `custom`, stamped from the turn they were added on. Tombstoned rows are not in the array |
| Q5 | Entity entries gain read-only `location`, the name of where the entity stands, and `following`, whether it follows the player. They pair with `present` on a location |
| Q6 | This spec fixes the dropped writes of a player-toggled trait switch: its memory, pin and diary writes land as the other timings' do |
| Q8 | No `visited` on a location entry. Nothing records visits today; it waits for a use case |
| Q9 | `memories.add`, `memories.pin` and the entry verbs land at commit and never read back within the run, the rule of `location.move` and `entities.X.move` |
| Q10 | A location entry's `description` is the full AI description, the precedent of the Tool surface's items |
| Q11 | `locations.X.present` holds entity entries, the same entries `entities` holds |
| Q12 | In the editor's Test Code run and in the Test Bench, `memories` is an empty array. Writes list in the run output |
| Q13 | The hover-card and tree analysis gain array elements: `memories[0].text`, `memories.at(-1)` and `locations.X.present[0].name` resolve to cards |
| Q15 | `pin()` and `forget()` on a Custom line do nothing and list as dropped writes in the run output, as a read-only write lists today. `edit(text)` and `remove()` work on one |
| Q18 | A script's verdict, edit or removal persists through a rewind, as a player's does. No per-write turn tag in the save |
| Q19 | `present` lists the played persona when the player stands there |
| Q20 | `entities.X.location` reads an empty string for an entity with no runtime position, which stands at every location it is authored to list. Such an entity appears in `present` at each of them |
| Q22 | The Tool surfaces align with Scripts rather than keeping their own shape |
| Q23 | World Tool scripts take the `memories` writes, landing when the tool call commits, as their stat and trait writes do |
| Q24 | World Tool scripts already run on the script surface plus `args`, so they align at no cost. User Tool scripts converge read-only: the same globals and entry shapes, no writes. Their text migrates at settings load |
| Q26 | `scene` dissolves. `persona` is the shared global; `inScene` reads from each entity entry; `notes`, the player's notes, becomes a `notes` string global on both surfaces |
| Q27 | Dictionary entries live under each book: `dictionaries.X.entries`, a map by entry name with `id`, `name`, `keys`, `value`. User Tools get the same `dictionaries` global. No flat `dictionary` global |
| Q28 | The user Tool migration rewrites only forms with an exact equivalent. A leftover old path stays as written; the editor marks it unknown with a hover card naming the new form |
| Q29 | Q20 holds in the editor too: Test Code and the Test Bench build from the opening state, which has no runtime positions, so an entity appears in `present` at every location it lists, and the persona at the starting location. Ticket 01's criterion "an empty `present` except the starting location's persona" reads as this (ticket 01 ruling) |
| Q30 | `description`, `summary` and `aliases` on an entity entry, and `description`, `summary` on a location entry, read with placeholder chips resolved to the playthrough's values, the text the AI reads. The user Tool items resolve today, and Q24 must not change what a user Tool reads. In the editor they resolve against the turn-one snapshot the run already holds (ticket 01 ruling) |
| Q31 | With no played entity, the empty persona entry never appears in `present`. The Custom Persona entity and Test Code's pending stand-in appear as the persona (ticket 01 ruling) |
| Q32 | Discovered characters are entries of `entities`, with every entry field, since they are persisted per-save entities with their own position and the user Tool surface already lists them (Q24 keeps `Object.values(entities)` exact). Ticket 01 owns adding them to the snapshot's entity list. `entities[x]` for a name no entry has stays the unknown entry with empty reads: in play its `diary`, `move` and `follow` fail with the old "no entity named" message; in the editor, which has no discovered cast, its `diary` is the existing may-be-discovered warning, not a failure. Ticket 02 builds `diary` on the entry and the unknown path, independent of ticket 01 (ticket 02 ruling) |
| Q33 | `dictionaries.X.entries` follows the other entry maps: a disabled entry is absent, as a muted book is, which keeps the user Tool's "every enabled entry" read exact under Q24; an unknown name reads a blank stray entry with empty `id`, `name`, `value` and `keys` of `[]`; a write to an entry field reports as a read-only write; two entries with one name in a book, the later wins; entry names are code names through the same resolver book names use (ticket 06 ruling) |
| Q34 | The old surface is released: `memory.add`, `memory.pin`, `diary` and `location.move` shipped in 3.3.2 and the switch timing in 3.3.1, both collapsed release blocks below In Progress in the changelog. Every ticket's user-facing change is a new In Progress entry, and the switch landing fix is a 👤 Fixed entry; nothing folds into a released entry (ticket 04 ruling) |
| Q35 | The world rewrite resolves a `diary` string literal that equals an entity's id to that entity's code name, `diary("e-mira", x)` to `entities.Mira.diary(x)`; an expression stays `entities[expr]`. At run time, the unknown entry's `diary` resolves the key it was read with by id, else by name, against the cast, as the old `diary` did, so an id held in an expression still lands and the editor's may-be-discovered warning still applies to a miss. `move` and `follow` on an unknown entry keep failing (ticket 02 ruling) |
| Q36 | The switch landing covers every path that fires When a Trait Switches between turns: the player's toggle, a persona change and the per-turn settle. Story 18 names the toggle as the case a player sees; Q6's rule is the writes land as the other timings' do. A run that ends while a turn is in flight is held and lands when that turn ends (ticket 04 ruling) |
| Q37 | The prelude grows with world size: 10,000 dictionary entries of 1 KB cost 253 ms per run, paid by every script in every timing. Ticket 06 lands with a text gate, the precedent of the `player.` engine gate: entries reach only code whose text names `dictionaries`; a computed global reads empty entries. A new ticket 12 then builds host-backed lazy reads for heavy text, dictionary values, entity and location descriptions and summaries, memory text, in the script runtime and the user Tool runtime, so the prelude carries names, ids and the small fields only (user ruling via ticket 06) |
| Q38 | `memories[i].turn` is the play turn number, the story's count derived from the history position, not the Memory panel's memory ordinal. A digest row reads its own turn; a Custom line reads the turn that closed before it was added. Turns with no digest still count, so `turn` matches what the player counts and stays meaningful with digests off (ticket 03 ruling) |
| Q39 | Ticket 03 owns the memory entry surface list, the eleven read-only fields with their help lines, the `memories` global card naming them, the `memories.add` and `memories.pin` cards, and the Memories menu group with the two verbs. Ticket 07 owns element resolution against that list, the element cards, and the menu's element-field rows, for `memories` and `present` alike, so the menu learns arrays once (ticket 03 ruling) |
| Q40 | The memories list follows the Sandbox Snapshot rule: captured once per turn, read by every run of that turn. Ticket 03 landed reading the list play built at its last render, which agrees except when the panel changes between a turn's runs; ticket 05 moves the capture into the snapshot as it lands the write channel (ticket 03 landing note) |
| Q41 | Ticket 05 owns the memory entry verb list, `pin`, `forget`, `edit`, `remove`, with their help lines, as function-detail entries in the one entry field list, the way the entity field list holds `move` and `diary`, since the Quick Reference guard pairs listed members with what the executor answers. Ticket 07 resolves element verbs from it; if 05 has not landed when 07 is ready, 07 rebases onto it before prepare (ticket 07 ruling) |
| Q42 | Element resolution covers the first parameter of an array method's callback and a for-of binding, so `m.custom` in `memories.filter((m) => m.custom)` and `m.text` in `for (const m of memories)` resolve as the element does (ticket 07 ruling) |
| Q43 | Menu shape for arrays: the Memories group keeps `add` and `pin` and gains a `memories[0]` group holding the entry fields, and the verbs once 05 lands, each inserting `memories[0].<field>` with the `0` selected to type over. `present` under Location and under each Locations row is a group: a `present` leaf inserting the list itself, then the entity entry fields as `location.present[0].<field>` with the `0` selected (ticket 07 ruling) |
| Q44 | User Tool sandbox: every field is read-only; a field write drops, the read keeps the snapshot value, the Tool never fails on it, and the Tool editor's test run lists the write under dropped writes as a script's read-only write lists. `self`, `owner`, `trait`, `narration`, `player`, `discover` and `clock.advance` are absent. The Settings sample world keeps its in-progress state, persona, notes, three memory rows, day 3 evening, since it stands in for a game; the World Editor and the no-world case read the opening clock and no memories. A user Tool script runs through the same executor and Sandbox Snapshot as Scripts in a read-only mode, and mid-turn reads what an On Call World Tool reads at that moment (ticket 08 ruling) |
| Q45 | Memory verdict landing: an On Call World Tool's verdicts ride the turn's world writes and land at the turn commit, as its memory lines do; an After-timing World Tool's land with the After batch. A Custom-line `pin()` or `forget()` joins the read-only write list and both editor surfaces format it through that one path; since Q12 keeps the editor's `memories` empty, the editor half of that criterion is proved at the executor and left unticked with the reason. `edit(text)` on a digest is the panel's Save: a player-source edit plus a keep verdict; on a Custom line it rewrites the text in place with no original. Writes apply in call order across one timing's scripts, so the last verdict stands. The memories capture is taken once at turn start beside the location capture; a run between turns reads the live list (ticket 05 ruling) |
| Q46 | Element leaves insert with optional chaining at the element, `memories[0]?.text` and `location.present[0]?.name`, with the `0` selected, so every leaf still runs as inserted in Test Code where Q12 keeps `memories` empty and `present` is often empty. The leaf reads `undefined` on an empty list and the real value in play. Q43's insert forms read this way (ticket 07 ruling) |
| Q47 | The `present` element rows in the Variable menu list the entity entry's read fields only, under Location and under every Locations row: the persona stands first wherever the player is and has no verbs, so an inserted `present[0]?.diary(...)` would usually fail. Cards and completion still resolve the verbs on any element (ticket 07 ruling) |
| Q48 | A book's `entries` map comes from the host on the first read of `dictionaries.X.entries`, through the same host-read primitive, so an unread book costs nothing; each entry's `value` stays lazy per field. The book list stays in the prelude. Entities, locations and memories keep their small fields in the prelude with lazy text. Ticket 12's measurements rule out the 3× bound for any prelude carrying 10,000 entries' small fields: parsing their ids and keys alone is 6× the empty run (ticket 12 ruling) |
| Q49 | Every host call pauses the run's one-second budget on both engines, one rule in the sandbox runner, so a text read matches a prompt; the placeholder `roll()` hook pauses too (ticket 12 ruling) |
| Q50 | Two Migrations rows move to the flagged list under Q28: `scene.present` and `scene.inScene`, since the persona-first `present` (Q19), the always-in-scene persona entry and the old unmatched participant names make no rewrite exact. `world.entities` stays rewritten to `Object.values(entities)`: only a library or Custom persona's entry is added, and Q32 already calls that form exact. A missing stat reading a stray entry's `0` where `scene.stats.Nope` read undefined is accepted, the Q33 rule. The user Tool rewrites register as their own list beside the script rewrites, the memory and diary rows included, and apply at the one Tool parse boundary that settings load, Formaquestion Tools, pack import and preset import share. The sample snapshot gains the scene's in-scene ids in this ticket so its parity run is honest (ticket 09 ruling) |
| Q51 | "The editor marks it unknown with a hover card naming the new form" (Q28) is the unknown-path diagnostic, spanning the whole flagged path and naming the new form, such as “scene.traits” isn’t available in a Tool script. Use “traits”. The lint tooltip is the hover; no card kind for retired paths, keeping the rule that a misspelled name is the diagnostic's to explain. A path with a rewrite never shows, since load rewrote it; any other `scene.` or `world.` read keeps today's message (ticket 09 ruling) |
| Q52 | A `world.entities`, `world.locations` or `world.dictionary` occurrence rewrites only when the script never returns, stringifies or spreads an item from it and reads no `.placeholders` member off one; field reads such as `.map((e) => e.name)`, `[i].name` and `.find(...).id` are exact. Everything else stays flagged with the new form named, since a whole item's JSON shape changed: locations gain `starting` and full `present` entries, entities gain play fields and object placeholders, dictionary entries lose the book's resolved placeholders. A projection rewrite that rebuilds the old item shape is rejected as verbose text in the author's script (ticket 09 ruling) |
| Q53 | In a read-only user Tool run, enumerating an entry's keys fetches its lazy fields, since the read-only view returns value descriptors and `Object.keys` asks for each. Accepted and recorded: values stay correct, a Tool runs once per AI call, and accessor descriptors would be observable from a script. Scripts are unaffected. Ticket 12 adds no changelog fragment: the entries, the gate and the slow prelude are all unreleased, so the no-churn rule applies (ticket 12 ruling) |
| Q54 | Q30 extends to dictionary entries: `dictionaries.X.entries.Y.value` reads with placeholder chips resolved, the text the AI reads and what `world.dictionary[i].value` read before ticket 08. Ticket 06 landed it raw; ticket 12 resolves it at the host read it is building and pins the resolved reading in its test, so ticket 09's `world.dictionary` rewrite stays exact (ticket 12 finding) |
| Q55 | `world.dictionary` is never rewritten; it stays flagged with "Use “dictionaries”." The map form keys by entry name, so an empty-named entry has no key and of same-named entries only the later survives (Q33), and imported lorebooks often have both; the old array listed every enabled entry and settings load cannot see the world to check. `world.entities` and `world.locations` stay under Q52, since an unnamed or same-named entity or location is rare. Accepted under earlier rulings: aliases resolve chips (Q30); a switched-off stat reads its value where `scene.stats.X` was absent (Q33 class); reads that threw before now return values, and a script that threw had no text to keep; a destructured local blocks the `notes` rewrite as any declared name does (ticket 09 ruling) |
| Q56 | Card copy bar: a field entry is one sentence under 20 words. A verb entry may run to two short sentences, each under 20 words, since the second carries behavior the author needs at the call: the Custom-line no-op, the restore path, the unknown-name error, the persona's missing diary. No sentence anywhere is over 20 words (ticket 11 ruling) |
| Q57 | The Tools guide keeps one migration section that prints the old forms beside their new spellings and the flagged ones, since a Tool author needs to see what load rewrote and what the editor flags. The no-old-names check exempts that one section; every other guide section stays clean (ticket 10 ruling) |
| R7 | In every Variable menu group, the fields come first and the verbs last, each set in its existing order. One rule in the tree builder covers entities, `location`, `clock`, `memories[0]`, the Memory group and every other group with a method (user, 2026-10-21) |
| R8 | `player.askText` becomes `player.input`, the name most game engines use for a typed answer. It shipped in 3.3.1, so the load-time rewrite pass turns `player.askText(` into `player.input(` in every script; the async-engine gate on `player.` is unaffected. The card, the guide, the Design System entry for the inline prompt line and the copy test follow (user, 2026-10-21) |
| R9 | A Variable menu row shows its type and its access, not the label alone: the row's `detail` in muted mono on the right, as the Tool editor's reference list prints it, and a small lock glyph on a read-only row, the hover card's access badge reduced to one mark. A writable row carries no glyph; a method is told by its type, such as `(line) => void`. The row's tooltip keeps the help line. The combined row is a pattern call: the ticket shows a static frame from the design-system showcase for the user's approval before it builds (user, 2026-10-21) |
| Q58 | The approval frame for R9 comes from the real menu: the row change made in the worktree, the menu opened in a script box through the dev-router on the entity entry group and the `memories[0]` group, framed in both themes. The showcase has no Variable menu reference and an unapproved pattern stays out of its registry; the Design System entry and a showcase reference follow approval. A field writable after this run gets no glyph, since it is a write; its tooltip keeps "Writable after this run." (ticket 15 ruling) |
| Q59 | The approved row pattern, from the frame: the access mark sits in a leading gutter, the read-only mark was the pencil-off icon at the frame, and the menu widens to 18rem to hold the type column (user, via ticket 15) |
| Q60 | After seeing the landed menu the user chose the lock over pencil-off for the read-only mark; the follow-up commit "Use the Lock for Read-Only Variable Menu Rows" and the Design System entry carry it. R9's lock stands (user, 2026-10-21) |

## Surface

Every entry below is read-only unless a row says it takes a write. Maps use the key rules of `entities`: a name with a space reads through brackets.

### Locations

| Path | Reads |
|---|---|
| `locations` | Every location of the world by name |
| `locations.X.id` | Unique id |
| `locations.X.name` | Code name |
| `locations.X.description` | The full AI description |
| `locations.X.summary` | The short AI summary |
| `locations.X.starting` | Whether it is a candidate starting location |
| `locations.X.present` | The entity entries standing there: the persona first when the player is there, then the entities in `entities` order. An entity with no runtime position appears at every location it lists |
| `location` | The current location's entry, with every field above, plus `move(nameOrId)`. In a world with no location, `id` and `name` are empty and `present` is empty |

### Entity entries

New members on every entry of `entities`, on `owner` and on `persona`:

| Member | Reads or does |
|---|---|
| `location` | The name of where the entity stands. A follower reads the player's location. Empty with no runtime position |
| `following` | Whether the entity follows the player |
| `description` | The full AI description |
| `summary` | The short AI summary |
| `aliases` | Other names for the entity |
| `diary(line)` | Adds a line to the entity's diary for this turn, after the AI's entry. The persona has no diary; the call fails the script as the top-level `diary` did |

### Memories

| Path | Reads or does |
|---|---|
| `memories` | The Memory panel's rows, oldest first: live digests and Custom lines. Tombstoned rows are absent. Empty in Test Code and the Test Bench |
| `memories.add(line)` | A line on this turn's digest, after the AI's summary. Judged by the selector like any digest |
| `memories.pin(line)` | A line that rides every request, listed under Custom |
| `memories[i].id` | The row's id |
| `memories[i].turn` | 1-based play turn number. A Custom line reads the turn that closed before it was added (Q38) |
| `memories[i].timestamp` | Story hours at the end of that turn, the scale of `clock.elapsedHours` |
| `memories[i].day` | Day number at that time |
| `memories[i].daypart` | Daypart at that time, the same six values `clock.daypart` has |
| `memories[i].text` | The text as the panel shows it, edits included |
| `memories[i].custom` | True for a Custom line |
| `memories[i].kept` | Whether the memory rides in the story's context as a standing verdict |
| `memories[i].inContext` | Whether it reached the model on the last turn |
| `memories[i].pinned` | A keep verdict stands on it |
| `memories[i].forgotten` | A drop verdict stands on it |
| `memories[i].pin()` | Sets a keep verdict. On a Custom line, a no-op listed as a dropped write |
| `memories[i].forget()` | Sets a drop verdict. On a Custom line, a no-op listed as a dropped write |
| `memories[i].edit(text)` | Rewrites the text as a player edit, the original kept behind it |
| `memories[i].remove()` | Tombstones the row |

### Dictionaries

| Path | Reads |
|---|---|
| `dictionaries.X.entries` | The book's entries by entry name |
| `dictionaries.X.entries.Y.id` | Unique id |
| `dictionaries.X.entries.Y.name` | Name |
| `dictionaries.X.entries.Y.keys` | The keywords that trigger the entry |
| `dictionaries.X.entries.Y.value` | The entry's text |

### User Tool scripts after convergence

Globals: `args`, `entities`, `locations`, `location`, `memories`, `clock`, `persona`, `dictionaries`, `stats`, `traits`, `placeholders`, `notes`, `console`. Every entry has the shape the Scripts surface gives it. No verb exists on this surface: `memories.add`, `memories.pin`, the entry verbs, `location.move`, `entities.X.move`, `follow`, `unfollow` and `diary` are absent, so a call is an ordinary not-a-function error. `clock` always exists; outside a game it reads the opening. `world` and `scene` are gone.

### Migrations

World scripts, World Tool scripts and user Tool scripts, on load:

| Old form | New form |
|---|---|
| `memory.add(` | `memories.add(` |
| `memory.pin(` | `memories.pin(` |
| `diary("Mira", line)` | `entities.Mira.diary(line)` |
| `diary(expr, line)` | `entities[expr].diary(line)` |
| `player.askText(` | `player.input(` (R8) |

User Tool scripts only, on settings load:

| Old form | New form |
|---|---|
| `world.entities` | `Object.values(entities)` |
| `world.locations` | `Object.values(locations)` |
| `scene.location.id`, `scene.location.name` | `location.id`, `location.name`; every other member is flagged (ticket 09 as built) |
| `scene.time.elapsed` | `clock.elapsedHours` |
| `scene.stats.X` and `scene.stats["X"]` | `stats.X.value` and `stats["X"].value` |
| `scene.notes` | `notes` |

Bare `scene.location`, bare `scene.time`, `scene.traits`, `scene.persona`, `scene.present`, `scene.inScene` and `world.dictionary` have no exact equivalent (Q50 and Q55 moved the last three here): the old text stays and the editor flags it with the new form (Q28). An entity item's `placeholders` read resolved text on the old surface and placeholder entries on the new one; a read of `world.entities[i].placeholders.X` is flagged, not rewritten.

## User Stories

1. As a world author, I want to read every location of the world from a script, so that a rule can name any place without hard-coding its id.
2. As a world author, I want `location` to have the same fields as a `locations` entry, so that I learn one shape for the current place and every other.
3. As a world author, I want to know which entities stand at a location, so that a script can react to who is in the room.
4. As a world author, I want to know where an entity stands and whether it follows the player, so that a script can move or release a companion on a condition.
5. As a world author, I want `diary` on the entity's entry beside `move` and `follow`, so that every action on an entity reads the same way.
6. As a world author, I want to read the story's memories as a list with their text, turn and verdict, so that a script can act on what the story remembers.
7. As a world author, I want each memory's story-clock time as a number, so that a script can compare it with `clock.elapsedHours`.
8. As a world author, I want each memory's day and daypart, so that a script can gather the memories made at night without knowing the world's calendar.
9. As a world author, I want to pin, forget, edit or remove a memory from a script, so that a story rule can shape what the AI keeps without the player opening the panel.
10. As a world author, I want a pin or forget on a Custom line to be skipped and listed, so that a loop over the whole list works and the run output still tells me what it skipped.
11. As a world author, I want `memories.add` and `memories.pin` to mean what `memory.add` and `memory.pin` meant, so that my mental model survives the rename.
12. As a world author, I want my shipped scripts to keep working after the update, so that a world I published does not break for its players.
13. As a world author, I want a dictionary's entries readable from a script, so that a rule can check what lore the world holds.
14. As a world author, I want the Variable menu to insert a one-item call directly, so that I do not open a menu to reach one thing.
15. As a world author, I want hover cards on `memories[0].text` and `location.present[0].name`, so that an array read is as documented as a map read.
16. As a Tool author, I want a user Tool script to read the world with the same names and shapes a world script uses, so that I learn one surface for both.
17. As a Tool author, I want my shipped user Tool scripts rewritten where the rewrite is exact and flagged where it is not, so that an update neither breaks me silently nor changes what a script means.
18. As a player, I want a trait I toggle to land the memory and diary lines its script writes, so that a switch script works as the author tested it.
19. As a player, I want a script's verdict on a memory to show in the Memory panel like my own, so that I can see and undo what a world did to my memories.
20. As a help reader, I want the Scripts guide and the Tools guide to describe the new surface, so that the help window answers questions about it.

## Implementation Decisions

- **One snapshot feeds every read.** The Sandbox Snapshot gains the location entries with their present entities, each entity's position and follower state, the dictionary entries, the player's notes and the memories list. Play builds it once per turn from the ledger the Memory panel builds; the editor builds it from the authored world with an empty memories list. The user Tool runtime builds the same shapes from its Tool Snapshot.
- **Entries in `present` are the entries of `entities`.** The prelude builds the entity entries first and places the same objects into each location's `present`, so identity holds and the serialized snapshot carries each entity once, by name.
- **Memories ride the executor's write channel.** `memories.add`, `memories.pin`, verdicts, edits and removals collect into the run's world writes beside location and diary writes. The merge keeps order across scripts of one timing. The turn commit lands them on the save's existing fields: memory lines on the turn, pinned lines as notes, verdicts on the pins record, edits on the overrides, removals on the deleted set. No save field is added.
- **The prelude stays cheap.** The memories list is serialized as the trimmed entry shape only. A long game is hundreds of rows, so the snapshot carries no original text, no override history and no relevance scores.
- **Custom line stamps come from the anchor.** Script-pinned lines and player notes both record the history position they were added at. Turn, timestamp, day and daypart derive from that position through the same clock resolver the panel's stamp uses, so a script and the panel never disagree.
- **Verdict no-ops are dropped writes.** The executor's existing dropped-write list, which reports read-only writes, also lists a `pin` or `forget` on a Custom line. The Test Bench and Test Code show them the same way.
- **The switch landing consumes what it already returns.** A player-toggled switch run returns its world writes today and nothing reads them. The fix lands them through the same path as a Before-the-AI run's world writes, between turns, on the latest turn.
- **Migration uses the rename machinery.** The world migration already rewrites retired script routes with the tree-sitter splice path; the `memory` and `diary` rewrites join that pass and stay idempotent. User Tool scripts get a matching pass at settings load, with the exact-equivalent table above and nothing else.
- **Editor analysis gains an element kind.** The resolver learns an array value whose element shape is known: numeric index, `at`, `find` and the other element-picking calls resolve to the element's members. The Variable menu's group node draws as a leaf when it has one child.
- **User Tool surface is the script surface minus writes.** The user Tool surface composes from the script surface's entries with every write member removed and `args` and `console` added. The Tool guide links move with it.
- **`clock` in a user Tool always exists.** The null-while-off reading of `scene.time` goes; a Tool outside a game reads the opening clock.
- **No export-shape change.** World and save files keep their shape. Script text inside a world changes on load and is text, not shape.

## Testing Decisions

A good test runs a script and asserts on the result and the writes, never on the prelude's text. The seams:

- **The executor**: a script over sandbox inputs. Reads of every new global; each verb's write; the dropped-write listing for Custom lines; the user Tool sandbox refusing writes by absence. Prior art: the executor's memory-write and location tests.
- **The Sandbox Snapshot builder**: playthrough state in, sandbox inputs out. `present` with the persona and an unplaced entity; entity `location` and `following`; memories entries with their stamps from the ledger; the editor's empty list. Prior art: the snapshot and the memory-view tests.
- **The turn commit**: a run's world writes in, the save fields out. Verdicts, edits, removals and lines on their fields; the switch landing fix proved by reinstating the drop. Prior art: the turn-commit tests and the script-pins tests.
- **Migration**: the world pass and the settings pass over fixtures, run twice for idempotence; a flagged form left as written. Prior art: the scripts migration tests.
- **The editor analysis**: resolver, cards and tree as pure functions over code strings. An element path resolves to a card; a one-child group renders as a leaf. Prior art: the code-cards and variable-tree tests.

Every guard proves it bites: a test that reinstates the old behavior fails.

## Not In This Effort

- `visited` on a location entry (Q8).
- `player.move` (R1).
- Runtime aliases for the old names (Q1).
- Rewind of script verdicts, edits and removals (Q18).
- Live read-back of writes within a run (Q9).
- Writes from a user Tool script (Q24).
- Semantic rewrites of user Tool text with no exact equivalent (Q28).

## Test Seams

- The executor: reads of the new globals, the verbs, the dropped-write list, the user Tool read-only sandbox.
- The Sandbox Snapshot builder: present entities, entity position and following, memory entries with stamps, the empty editor run.
- The turn commit: verdicts, edits, removals and lines on the save fields; the trait-switch landing.
- Migration: the world pass and the user Tool settings pass.
- The editor analysis: array elements, the one-child leaf.

## Further Notes

- The Scripts guide and the Tools guide change with the surface; the help vectors rebuild before release.
- The changelog gets one entry per user-facing change: the new reads, the memories verbs, the switch fix, the user Tool convergence.
- Backlog: `visited` on locations; a `player.move` once `player` no longer forces the async engine; a flat dictionary-entry lookup if authors ask for one.
- Landing notes from ticket 08: a user Tool's placeholder entries now read as a Script's do, so an entity placeholder holding `{{char}}` no longer resolves per owner, and `roll()` is absent on them. A thrown `Error("interrupted")` is a script error in every script now; only the engine's own interrupt counts as a timeout. A user Tool's snapshot starts over after an On Call World Tool writes mid-turn; that change is inline in the game view and untested, so close-spec reviews it. The guide gained a Notes section for the `notes` global because the guide-link guard needs the heading; the rest of the guide is ticket 10's. The live Tool editor read was not done; the menu, cards and reference list pass their tests.
- Structural note from ticket 09: the code-tree name helpers moved out of the script resolver into their own module, re-exported from the resolver, because the user Tool load path must not load the script executor; a lazy-load test caught it on the first prepare.
- Accepted edge from ticket 03: the rewrite pass leaves a script that declares its own `memory` or `diary` untouched, so a global `memory.add` inside such a script fails at run time. Same rule as the diary pass; a shadowing script cannot have meant the global.
