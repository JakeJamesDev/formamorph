# Placeholder Text Fields

Status: done
Status note: Closed 2026-10-25. Tickets 01–04 landed, last landing fefabc96e; ticket 04 closed the lens scope gap the review found. Closed red: `scripts/testSelection.test.mjs` failed on a peer's untracked script, and `src/lib/testBench/pinConflictLoad.test.ts` failed under load but passes alone. Lint green.
Spec session: placeholder-text-fields — spec

## Problem Statement

Placeholder chips work in most world text, but three fields that reach the AI still take only plain text: a connection's **Travel Hint**, an entity's **Pronouns**, and an entity's **Relationship** labels.

An author who rolls a door color can't say "through the {Door Color} door" in a Travel Hint. An author who gives an entity a rolled identity can't put a chip in its pronouns. A relationship label can't name a rolled role. The author has to write fixed text or leave the field blank.

## Solution

The three fields become chip fields, the same single-line kind as entity and location names. The author inserts chips with the `{` typeahead, the palette strip, or a drag.

In play, each chip resolves to its roll, in the right scope. The AI reads the resolved text in location context, entity context and relationship lines. Play-time stat code reads resolved pronouns. The editor map canvas shows a chip-bearing hint as values in braces.

Linked Travel Hints share their chips, so both directions read the same value. Unlinking gives the second leg its own placements, so each direction rolls on its own.

## Rulings

Settled in the grill on 2026-10-25, then checked against the code by a review pass and reopened where the code disagreed.

- **Q1 Scope.** Travel Hint, Pronouns and Relationship Label get chip support. Entity Type stays plain, because stat code reads it as a code key, like a name. The dictionary book Description and Script Name stay plain, because they are editor-only text.
- **Q2 Link.** Linking two Travel Hints copies the first leg's chips exactly, placement ids included. A Unique chip then draws one roll that both directions share.
- **Q2b Unlink.** Unlinking gives the second leg fresh placement ids. Each direction then rolls on its own, and the pair no longer reads as linked.
- **Q2c Unlink scope (ticket 01).** Unlink re-mints only the placement ids the second leg's restored text shares with the first leg. A held text with its own placements keeps them and their rolls.
- **Q9 Letter order (ticket 01).** Connection hints take placement letters right after locations, in connection order, the A-to-B leg before the B-to-A leg.
- **Q10 Test Bench owner (ticket 01).** Each leg is its own chip owner, filed under its departure location and named "<From> → <To> Travel Hint".
- **Q11 Search (ticket 01).** Each unlinked leg is a search target under its departure location, labeled "Travel Hint to <To>". A linked pair is one target on the first leg, and a replace there writes both legs, as typing in the first box does. Search never unlinks a pair.
- **Q12 Label search (ticket 03).** Each relationship label is a search target under the holding entity, labeled "Relationship to <Target>": "Relationship to Persona" for the You row, "Relationship to Unknown Entity" for a dangling target. A chip-bearing target name shows in the braces form.
- **Q13 Label scope route (ticket 03).** Labels join the entity text resolver, which both chip scenes run on every entity before the relationship cast. The cast itself doesn't change. The Test Bench lens gets its own entity resolver (ticket 04, Q16–Q18).
- **Q14 Placed ids (ticket 03).** The entity editor modal's placed-ids list includes relationship labels, as it does pronouns.
- **Q16 Lens pins (ticket 04).** In the lens, an entity's text reads the lens PC's traits, then the entity's default traits bound to its copies, with the lens location and starting stat bands on top. This is the play layering, with the entity's defaults standing in for its trait state.
- **Q17 Lens Character Name (ticket 04).** A Character Name chip in an entity's text shows that entity's name in the lens, as play does.
- **Q18 Lens owned traits (ticket 04).** An entity's owned trait text keeps the self-pin rule in the lens: the trait's own pins sit over the entity's scope, never replaced by it.
- **Q15 Focus handle (tickets 01, 03).** Ticket 01 owns the chip field focus handle. Ticket 03 builds against the same names and prepares after 01 lands.
- **Q3 Canvas.** The editor map canvas shows a chip-bearing hint as values in braces (the `describePlaceholders` form). The AI Context instrument already shows resolved text and keeps doing so. The game map shows no hint labels.
- **Q4 Code.** Play-time stat code reads pronouns resolved in the entity's scope, like descriptions and aliases. Editor runs have no rolls and read placeholder names, like entity names.
- **Q5 Chips only.** Pronouns accept chips and nothing more. Making pronouns follow a name roll is out of scope (see Further Notes).
- **Q6 Scope.** Pronouns and relationship labels resolve in their entity's scope: its owned placeholders and its own trait pins, as its descriptions do. A connection has no owner, so a Travel Hint resolves against global placeholders and the world's active pins, the current location's pins included.
- **Q6b Writer's scope.** A relationship label resolves in the scope of the entity that holds the row, before the rows move onto any other block (the target's or the persona's).
- **Q7 Old versions.** Players are expected to run the latest app. This work adds no version gate.
- **Q8 Tools.** Tool text (Tool Description, parameter Description, enum Options, handler Reply) is a separate effort.

## User Stories

1. As an author, I want to put a placeholder chip in a Travel Hint, so that the route description can name a rolled detail.
2. As an author, I want to insert a chip into a Travel Hint with the `{` typeahead, so that it works like every other chip field.
3. As an author, I want the palette strip to target a Travel Hint box when I focus it, so that I can click or drag a chip in.
4. As an author, I want linked Travel Hints to copy the first leg's chips exactly, so that both directions say the same thing.
5. As an author, I want a Unique chip in a linked hint to read the same value both ways, so that the route doesn't change between directions.
6. As an author, I want unlinking to give the second leg its own placements, so that I can make each direction roll on its own.
7. As an author, I want an unlinked pair with different rolls to stay unlinked, so that the link toggle shows the real state.
8. As an author, I want the map canvas edge label to show the values in braces, so that I can see what a hint can read as.
9. As an author, I want the AI Context instrument to show the resolved hint, so that I see what the AI reads.
10. As an author, I want world search to find text inside Travel Hints, so that I can locate and replace a word there.
11. As an author, I want a deleted placeholder in a hint to show as the red `?` pill in the editor and as nothing in play, so that it acts like every other field.
12. As an author, I want a Unique chip in a hint to roll once per playthrough, so that the hint doesn't change from turn to turn.
13. As a player, I want the AI to describe a route with the rolled value, so that the story matches the rest of the world.
14. As an author, I want to put a chip in an entity's Pronouns, so that the pronouns can come from a placeholder.
15. As an author, I want the Pronouns chip field to offer the entity's owned placeholders, so that I can use the entity's own values.
16. As an author, I want pronouns to resolve with the entity's own trait pins, so that a trait on that entity can set them.
17. As a player, I want the AI to read the resolved pronouns in entity and persona context, so that the narration uses the right pronouns.
18. As an author, I want play-time stat code to read the resolved pronouns, so that a script can branch on them.
19. As an author, I want Test Code to read pronouns as placeholder names, so that the editor run matches how it reads names.
20. As an author, I want world search to treat Pronouns as a chip field, so that search and replace keep the chips intact.
21. As an author, I want an exported entity card to carry the placeholders its pronouns use, so that the card works in another world.
22. As an author, I want an imported card's pronoun chips remapped onto the new world's placeholders, so that they keep resolving.
23. As an author, I want a chip in pronouns to count as a placement in the placement letters, so that the editor labels it like other placements.
24. As an author, I want to put a chip in a Relationship label, so that "mother, rival" can be a rolled role.
25. As an author, I want a relationship label to resolve in the scope of the entity that holds the row, so that its owned chips read correctly.
26. As a player, I want a relationship line on the persona's block to keep the label's resolved value, so that the line reads the same wherever it prints.
27. As an author, I want a blank-after-resolution label to print no line, so that an empty roll doesn't produce a broken sentence.
28. As an author, I want world search to find text inside relationship labels, so that I can locate and replace a word there.
29. As an author, I want relationship chips remapped when an entity is adopted or linked, so that they keep pointing at the right placeholders.
30. As an author, I want the Test Bench to know that hints and relationship labels hold chips, so that its placeholder rules cover them.
31. As an author, I want an opening that rolls placeholders to prime chips in hints and labels, so that nothing is rolled late.
32. As an author, I want a placeholder rename to show in these fields, so that the chip label follows the new name.

## Implementation Decisions

- **Editors.** The Travel Hint boxes, the Pronouns box and each Relationship label box use the single-line chip field (`PlaceholderNameField` over `ChipInput`). The Travel Hint pair keeps its focus request, so the box ref moves from the plain input to the chip editor's focus handle.
- **Link and unlink.** Link keeps copying the first leg's string verbatim. Unlink re-mints every placement id in the second leg's text with the existing deep re-mint helper. `hintsLinked` keeps comparing strings: after a re-mint, two legs with chips no longer compare equal.
- **Runtime resolution.** The entity text resolver resolves pronouns and every relationship label in the entity's scope. Connections get resolved hints from the resolved-world layer against global placeholders and the active pins. Location context reads resolved hints. Resolution happens on the way out of state, so the world stays authoritative for saves.
- **Relationship scope.** Labels resolve on the holding entity before the relationship cast moves rows onto the persona. Relationship lines then receive resolved labels.
- **Priming.** Roll priming reads connection hints, which it has no input for today. Without this, a Unique chip in a hint redraws on every render. Pronouns and labels prime through the entity text list.
- **Fixed field lists to extend.** These lists name the fields that hold chips. Each gains the new fields:
  - the entity text list: pronouns and relationship labels. It feeds priming, placement letters, Test Bench rules, card export, blueprint copies, owned traits in play and library placeholders.
  - the entity chip mapper in placeholder homes: pronouns and relationship labels. It drives remap on adopt, link repair and blueprint travel.
  - the world placement text list: connection hints.
  - the Test Bench chip owners: connections. It also feeds the chip-bearing texts for opening priming and the placed-ids list.
  - world search: Pronouns becomes chip-capable; new search targets for Travel Hints and Relationship labels.
  - the Sandbox Snapshot play fields: resolved pronouns.
- **Code reads.** Play-time snapshots add pronouns to the entity's resolved play fields. Editor runs keep the placeholder-name form.
- **Canvas.** The editor canvas edge label passes the hint through `describePlaceholders`. The game map keeps hiding edge labels.
- **No change.** The deep re-mint helper already walks every string. Card export has no relationships, so labels add nothing there.
- **Export shape.** Unchanged. Chips go into string fields that already exist (`Connection` leg `hint`, `Entity.pronouns`, `EntityRelationship.label`).

## Testing Decisions

- A good test drives the public seam and reads the result a player or author sees: resolved text, editor DOM, a code read. It never asserts on which helper ran.
- **Seam 1: Chip Values.** Build a world with chips in hints, pronouns and labels, plus rolls. Assert the AI context text: resolved hint in location context, resolved pronouns in entity and persona context, resolved label in relationship lines. Cover an owned chip in a label that prints on the persona's block (Q6b) and a Unique chip in a linked hint (Q2). Prior art: `chipValues/relationships.test.ts`, `liveScene.test.ts`, `locationContext.test.ts`.
- **Seam 2: Editor components.** Render the connection and relationship editors. Assert chips insert, link copies placements, unlink re-mints the second leg and leaves the pair unlinked, and the canvas label shows braces. Prior art: `LocationConnections.test.tsx`.
- **Seam 3: Sandbox Snapshot.** Assert play-time code reads resolved pronouns and an editor run reads the placeholder name. Prior art: `sandboxSnapshot.test.ts`.
- Priming, search, placement letters, remap and Test Bench lists each get one test at their own module, or a case at a seam above, that fails when the new field is dropped from the list. Prove each by removing the field and watching the test fail.

## Out of Scope

- Pronouns that follow a name roll. Value pins read only the World roll and apply to every chip of the target placeholder, so they can't tie one entity's pronouns to its name. Per-entity matching through Blueprint Copies is unverified.
- Tool text fields (Q8).
- Entity Type, dictionary book Description, Script Name (Q1).
- Entity listing `tags` (Community listing text, not world text) and `StatUpdate.prompt` (no editor).
- A version gate for older apps (Q7).

## Further Notes

- The pronouns-follow-name question needs its own prototype. Candidates: per-entity owned placeholder pairs with value pins (World chips only), Parts drill paths, or a resolver change that lets value pins key on Unique rolls.
- The review that checked this spec against the code overturned two first-round rulings (Q3 and Q5) and added Q2b and Q6b. The rulings above are the corrected set.
