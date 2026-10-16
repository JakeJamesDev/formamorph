# Spec: Owner Term Rename

Status: done
Status note: Closed 2026-10-13. Tickets 01–11 landed; last landing 37f5cefcb. Review fixes 2344aca08 and 7b649816c followed. Gates green on 2026-10-13 at 7b649816c.
Spec session: owner-term-rename — spec

## Problem Statement

Authors meet three words for one idea. The requirement picker says **Same Bearer**, the wiki explains "bearers", stat cards say **Owner**, the `owner` code global means the bearer in a Blueprint stat's code, and new code says "holder". The glossary keeps Bearer and Owner apart by one case only, a Blueprint trait reached through Links, and then lists the `owner` global as an exception. Authors don't know which word applies, and the code repeats the confusion in about 2,900 places.

## Solution

**Owner** is the one term. The owner of a trait, stat or placeholder is the entity or dictionary whose tree holds it, as its own item or as a Link or Copy. The world is never an owner. Where it matters whether an owner has its own item or a Link, the editor says **Own** or **Linked**. Bearer and holder leave the UI, the docs, the code and the world file.

## Rulings

Settled with the user on 2026-10-14.

| # | Ruling |
|---|---|
| Q1 | Owner covers traits, stats and placeholders |
| Q2 | Owners are entities only (with **You** for the persona); the world is never an owner. A Blueprint lives under Blueprints. The stat pass's "Other Stats … no one owns" stays true |
| Q3 | Where own vs. Link matters (Link panel, Detach, Overrides), the editor says **Own** or **Linked** |
| Q4 | The requirement picker's **Same Bearer** becomes **Same Owner**. The persona stays **You** |
| Q5 | The saved requirement key `bearer` becomes `owner`. Old files migrate at load time |
| Q6 | Code identifiers are renamed too, as a wide refactor in batches |
| Q7 | A placeholder's parent is called "parent placeholder" in prose and UI. Its saved `ownerId` key stays |
| Q8 | Stat cards show one **Owners** row, You first. Blueprint and loose world stats say what they are in the signature line; a loose world stat has no Owners row |
| Q9 | New files write `owner` only. v3.1–3.2 apps misread requirement targets in new worlds until players update |
| Q10 | Owner lists carry no Linked marks |
| Q11 | The hover-card spec review's behavior fixes live in code-hover-cards ticket 16. Its naming findings ride here |
| Q12 | A dictionary owns the placeholders it holds. Owner = the entity or dictionary whose tree holds the item |
| S1 | Tests sit at three seams: the import migration, the existing behavior suites under new names, and a term guard |
| T03-1 | Shared interface members (owner resolution, requirement options, owner choices, the requirement owner type) are renamed at their definition in ticket 03. Consumers in other areas change only the member access; their other names stay with their own ticket. Members can't carry aliases, so the expand step covers types and functions only |
| T03-2 | The requirement editor fields belong to ticket 03 for identifiers and comments. Their user-visible copy belongs to ticket 08 |
| T03-3 | Ticket 03 migrates owner-resolver consumers that no other ticket's area covers. Files in another ticket's area stay with it; ticket 11 catches leftovers |
| T04-1 | The owner trait tree's own members (its owner list and per-group owner) belong to ticket 04. Tickets 03 and 04 land in either order; the second rebases |
| T05-1 | In the placeholder tree, "holder" meaning the parent placeholder becomes "parent placeholder" in comments and test titles and `parent` in locals. The tree identifiers `holderOf`, `holderId` and `activeHolderId` keep their names, and the term guard allows them. "holder" becomes owner only where it means the entity or dictionary that owns a placeholder or pin |
| T06-1 | Ticket 06 renames the hover-card and stat-code members it defines and leaves owners.ts, trait gates and owned traits in play to their tickets (T03-1). The visible "Bearers" and "No bearers" copy belongs to ticket 07 |
| T07-1 | The stat card signature's kind label says `(Blueprint stat)` or `(world stat)`; entity stats stay `(stat)` |
| T07-2 | "You first" is an ordering rule: when You is among a card's owners, it leads. No playable entity is relabeled You |
| T07-3 | Placeholder cards split like stats (user ruling): an entity- or dictionary-owned placeholder shows **Owners**; a world placeholder says so in its signature and has no Owners row; a nested placeholder also shows **Parent Placeholder**, beside Owners when an entity or dictionary tree holds it (Q12). The Bearers row on a route over several becomes Owners |
| T07-4 | "No Owners" is the one form for the row value and the Find All Uses tag |
| T07-5 | The `self` card keeps `(global)` in its signature; its Stat row names the scope, as `(world stat)` or `(Blueprint stat)`. An entity box shows the stat plus Owners |
| T08-1 | Q3 applies only where wording names the own-vs-Link split in another term. The Link panel, Detach and Overrides strings already say Link or Linked, so they stay |
| T09-1 | S1's unchanged assertions cover behavior (which warnings fire, counts, targets). A ticket that owns user-visible copy updates the expected strings for that copy. Ticket 09 owns the Test Bench warning strings |
| T11-1 | Bundled world prose (the Emberwatch readme) moves to owner wording, and the term guard scans bundled worlds. Prose only; no key or shape change |

## User Stories

1. As an author, I want one word for "who has this trait", so that I don't learn Bearer, Owner and holder as three ideas.
2. As an author, I want the requirement picker to say **Same Owner**, so that "Smite requires Paladin" reads as Paladin on the same owner.
3. As an author, I want the persona to stay **You**, so that requirement rows read as before.
4. As an author, I want a trait's hover card to list its **Owners**, so that I see every entity that has it, own or Linked.
5. As an author, I want a stat card to show one **Owners** row, so that a Blueprint stat doesn't show "Owner" and "Bearers" side by side.
6. As an author, I want a Blueprint stat's card to say it is a Blueprint stat in its signature, so that I see where it lives without an extra row.
7. As an author, I want a loose world stat's card to show no Owners row, so that the card doesn't claim an owner no one is.
8. As an author, I want the Link panel and Detach to say **Own** or **Linked**, so that I know whether I'm editing an Override or the entity's own item.
9. As an author, I want a dictionary to be the owner of its placeholders, so that one rule covers entities and books.
10. As an author, I want a nested placeholder's parent called the "parent placeholder", so that "owner" never means two things.
11. As an author, I want the `owner` code global to mean the same as Owner everywhere else, so that the glossary needs no exception.
12. As an author, I want the wiki's traits, placeholders, entities, Stat Code Guide and Glossary pages to say Owner, so that docs match the editor.
13. As an author, I want the Test Bench warnings to say owner, so that a finding uses the editor's words.
14. As an author, I want the Design System's flyouts called Owner Flyouts, so that the showcase matches the app.
15. As an author with an older world, I want my requirement rows that name an owner to load unchanged, so that the rename never changes my gates.
16. As an author importing an entity file or a character card from before the rename, I want its requirement owners to load too, so that a shared entity keeps its gates.
17. As an author, I want new exports to write `owner`, so that the file matches the docs.
18. As an author reading the world format docs, I want the requirement key documented as `owner`, with a note that `bearer` loads too, so that hand-edited files keep working.
19. As a player on v3.1–3.2, I accept that a world saved after the rename can misread its requirement targets until I update.
20. As a developer, I want code names to match the glossary, so that reading code doesn't need a translation table.
21. As a developer, I want the rename to change no behavior, so that every existing gate, pin and requirement test passes with its assertions unchanged.
22. As a developer, I want a guard that fails when "bearer" or "holder" returns in the sense of owner, so that the term stays unified.
23. As a developer, I want the HTTP `Authorization: Bearer` header left alone, so that sign-in keeps working.
24. As a Formaquestion user, I want help answers to say owner, so that the assistant uses the editor's words.

## Implementation Decisions

- **Glossary.** The Bearer entry merges into an Owner entry: the entity or dictionary whose tree holds a trait, stat or placeholder, own or through a Link or Copy; the world is never an owner; the persona is **You**. Its _Avoid_ line lists bearer and holder. The `owner` global entry drops "the one exception". Entries that say Bearer (Condition, Stat Condition, Copy) move to owner. The player Glossary page swaps its Bearer row for Owner.
- **Saved shape.** The requirement field `bearer` becomes `owner`, with the same value shape (`you`, or an entity with id and optional name). The world migration rewrites `bearer` to `owner` and is idempotent. The entity file and character card importers run the same rewrite. Exports write `owner` only. The world format doc documents `owner` and notes that `bearer` loads.
- **Code rename** runs as expand–contract. First add the new names beside the old ones. Then migrate call sites in batches by area: trait gates and requirements, owned traits in play, pins and placeholders, stat code and hover cards, editor UI and the Design System, the Test Bench. Finally remove the old names. Exported types, functions, components and file names that say bearer or holder (meaning owner) get owner names. The in-memory player key, now named for the world, gets a player name, since the world is never an owner.
- **Not renamed:** HTTP `Authorization: Bearer` in services and on the server; the `holderOf` functions in the location and placeholder trees, which mean "parent"; the placeholder `ownerId` key (Q7).
- **Hover cards.** The Bearers rows become **Owners**. The stat card's separate Owner row merges into Owners (Q8); the signature names a Blueprint or loose world stat. The review's naming findings land here: the hover-card "holder" names and records, the use-row type named for stats though it carries every kind, the shared row builder's stats-only home, and the "No Bearers" tag (now "No Owners", one casing).
- **UI copy.** Same Bearer → Same Owner; "Search bearers" → "Search owners"; Test Bench warnings and help topics; the `owner` global's info line; Own and Linked wording on the Link panel, Detach and Overrides where it reads otherwise today.
- **Docs.** Traits, placeholders, entities, persona authoring, Stat Code Guide, world format, Design System and Glossary pages. The wiki heading "Whose trait counts" keeps its text and anchor. Released changelog sections keep their history; one In Progress entry describes the rename.
- **Export shape.** This changes the world file (Q5, Q9). Every ticket that touches the saved key carries the export-shape reminder.

## Testing Decisions

- A good test drives a public seam with a small world and asserts what an author sees or what a file holds. It never asserts on internal names.
- **Import seam (main).** An old world's `bearer` loads as `owner` with the same value; a second migration changes nothing; an entity file and a character card from before the rename load their owners; a fresh export writes `owner` and no `bearer`. Prior art: the world migration tests and the entity file and card import tests.
- **Behavior suites.** The requirement, trait-gate, owned-traits-in-play and pin suites move to the new names with every assertion unchanged. Renaming a test file or a describe line is fine; changing an expected value is not.
- **Term guard.** One test scans the docs and app strings for bearer or holder in the owner sense. It allows the HTTP header and the parent-tree `holderOf`. It is proven by putting "Same Bearer" back once.
- **Guards bite.** Reinstating a `bearer`-only reader fails the migration test.
- **Copy.** The `copy-sweep` skill reviews the changed labels and docs.

## Out of Scope

- The hover-card behavior fixes (code-hover-cards ticket 16).
- Writing both keys for old apps (Q9 chose `owner` only).
- Renaming the placeholder `ownerId` key.
- Rewriting released changelog sections.
- Any change to how requirements, pins or gates resolve.

## Further Notes

- Origin: the code-hover-cards spec review flagged "holder" against the glossary, and the user asked why Bearer was ever separate. Bearer came from Trait Links, when a Link was a pointer rather than something an entity owned. The `owner` global, Copies ("entity-owned") and Detach had since made a Link owned.
- Bearer has shipped since v3.1.0 (the picker label and the wiki), and the `bearer` key has been in world files since the same release.
- About 2,900 code occurrences and 41 exports carry bearer; the ticket split follows the expand–contract batches above.
