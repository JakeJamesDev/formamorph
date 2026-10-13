# Text Stats On The Owner Route

Status: proposal (draft by littleme02, for review)

## Problem Statement

Many facts about a character are words that change during the story, not numbers. "Scalp hair: Blonde, long, tangled", "Right-knee scar: absent", "Outfit: torn uniform, one boot". Today an author has three tools, and none fits:

- **Stats** are numbers with a bar, a range and regen. Height fits. "Hair: blonde, cut short" doesn't.
- **Placeholders** are text, but they are fixed when the game starts. Rolled or picked once, pinned by traits or code.
- **An entity's AI description** is one authored block in the world. The AI can't keep it current, and an edit there changes every game.

So a player who wants the AI to remember that a character cut her hair, lost a boot, or got a scar has to keep it in the notes by hand, or hope the summary keeps it.

The owner route gives every stat an owner: the world, the persona, or an entity. The stat pass already sends one block per owner in the scene. What's missing is a stat that holds text, and rows that can be added during play.

## Solution

A stat can be a **text stat**: its value is a line of text, with no bar, range or regen. Text stats live on the owner route like any stat: `stats`, `owner.stats`, `entities[x].stats`, `persona.stats`. Code can read them and write `value`.

An owner's text stats form its **sheet**, a list of `name → text` rows:

- **Templates.** A world can name **standard sheet rows** that every character starts with, such as a body table. An entity can pre-fill values and add its own rows.
- **Per game.** Values belong to the playthrough and are kept in every turn's snapshot, so rollback works. Rows can be added, removed and edited in play. Play never writes them back to the world.
- **To the AI.** A present owner's sheet goes in its block of the request, one `Name: value` line per row. Rows with **send** off and empty values are left out, and an absent character's sheet isn't sent.
- **AI updates.** After narration, one request covers every sheet in the scene. It answers one change per line: `Penny | Scalp hair: Blonde, cut short`. A new row is allowed (`Penny | Tattoo: rose, left wrist`), and `-` removes a row (`Penny | Tattoo: -`). With owner blocks this could also ride in the stat pass.
- **The turn line** lists changed rows (`Scalp hair: long → cut short`), and the turn editor corrects them like stat changes.
- **Copy and Paste.** Copy puts a sheet on the clipboard as a markdown table, `| Attribute | Value |`. Paste reads a markdown table, or `Name: value` lines (bullets and bold allowed), and merges by row name: a row of the same name takes the new value, and new names are added. Models write markdown tables natively, so a player can ask any chatbot for "a body table for this character" and paste it straight in.

## User Stories

1. As a player, I want a character's changing looks and state kept as text rows, so that the AI remembers a haircut or a scar without me writing it in the notes.
2. As a player, I want the AI to propose sheet changes after each turn, so that the sheet stays current without my work.
3. As a player, I want to see sheet changes in the turn line and correct them in the turn editor, so that a wrong update doesn't stick.
4. As a player, I want to add, remove and edit rows during play, so that the sheet can grow with the story.
5. As a player, I want to paste a markdown table into a sheet, so that a table a chatbot wrote becomes rows in one step.
6. As a player, I want to copy a sheet as a markdown table, so that I can move it to another character, game or tool.
7. As a world author, I want standard sheet rows for every character, so that each one starts with the same body table.
8. As a world author, I want an entity to pre-fill its own sheet values, so that a character starts as I wrote them.
9. As a player, I want a row's **send** box, so that a row I keep for myself doesn't go to the AI.
10. As a player, I want only present characters' sheets sent, so that absent characters don't fill the request.
11. As an author, I want stat code to read and write text stats like any stat, so that a trait or a stat can change a sheet row.

## Implementation Decisions

Open questions for rulings:

- **Q1** Is a text stat a kind of stat (shares the owner route, the stat tree and the code sandbox), or a sheet beside stats (its own panel and pass)? This proposal leans to a kind of stat.
- **Q2** Do sheet updates get their own pass and prompt, or ride in the stat pass's owner blocks? Own pass: one cheap request, separate temperature. In the stat pass: one fewer request.
- **Q3** Rows added in play: are they stats in the game state only, or written as a per-game overlay on the owner's stats?
- **Q4** Is a sheet sent as `Name: value` lines (as the working version does) or as a markdown table?
- **Q5** Where do sheets show in play: a Sheet tab beside Stats, Traits and Location, or inside each owner's stat panel?

## Testing Decisions

- Unit: seeding from world and entity templates; add, remove and edit rows; snapshot and rollback; what is sent (present vs absent, send off, empty values); reading the update reply (change, add, remove, unknown character, messy spacing, a markdown table reply); Paste (table, lines, bullets, bold, `\|` and `<br>` in cells) and Copy round trip.
- e2e: the request carries a sheet only while its character is present; a mocked update changes a row, and the side panel and the turn line show it; a correction in the turn editor sticks after the next turn.

## Out of Scope

- Pictures from sheets. A sheet can feed an image prompt, but that is its own spec.
- Sheets for locations.

## Further Notes

A working version runs in my fork (`ultra` branch): character sheets with world templates, entity values, per-game rows, a Sheet tab, the update pass, turn line and turn editor support, and Copy and Paste. It was built before the owner route, so it keeps sheets beside stats. On the owner route the same behaviour fits as text stats, and I'm happy to rebuild it that way for a PR.
