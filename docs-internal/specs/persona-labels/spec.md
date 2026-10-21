# Persona Labels

Status: done
Spec session: persona-labels — spec
Status note: 2026-10-20. Tickets 01–07 done. Last landing 1019f6786. Closed without gates.

The app names the character the player plays in five ways: `(You)`, a colored **You**, **You** as an owner, **Player Name**, and **PC**. This effort settles on two names. Players see their persona's name with a **You** pill after it. Authors see the word **Persona**. **Player** means only the person at the keyboard.

## Problem Statement

A player looks for themselves in the side panel and on the Enter World screen. The **Entities** tab says `Kate (You)`. The **Traits** tab and Enter World say `Kate` with a colored **You** after it. The persona row and the persona's stat heading say `Kate` with no mark. The player can't rely on one cue to find their own entity.

An author meets four more names in the World Editor. A relationship targets **You**. A requirement owner is **You**. A chip is **Player Name**. The Openings test tool says **Lens PC** and "the default character". In the editor, "You" is ambiguous, because the author isn't the one playing. "Player" sometimes means the person (`player.*`, "the player picks") and sometimes means the character (**Player Name**).

## Solution

- **In game**, every surface that shows the played persona's name shows a small **You** pill after it. The pill is one shared component, so every surface looks and aligns the same.
- **In the editor and the author docs**, the played character is **Persona**: the relationship target, the requirement owner, the built-in chip, and the Openings test tool.
- **Player** keeps one meaning, the person at the keyboard.
- AI-facing text doesn't change. That covers the `Player Character` header and key, and the chip's fallback words.
- The stored ids don't change, so world and save files keep their shape.

## Rulings

**In game**

- **Q1. The mark is a pill.** It's a rounded primary-fill badge that reads **You**. We picked it over plain colored text and over an icon-only mark with a tooltip. The icon had two problems: keyboard and touch users couldn't open its tooltip, and it repeated the empty-portrait glyph on the persona row.
- **Q2. The pill is small.** It's 14 px tall, with 9 px semibold text and 4 px side padding. The text centers in the pill to the pixel. The pill sits within 1 px of the middle of the name's capitals.
- **Q3. The name stays, and the pill follows it.** The mark never replaces the name.
- **Q4. The in-game surfaces come first.** They form a set of their own. The editor surfaces follow under Q5–Q20.
- **Q7. In play, requirement text shows the persona's name with the pill.** "Kate [You]: Elf", not a generic word.

**Words**

- **Q5. The editor calls the played character Persona.** It's the same word players see in game (**Change Persona**, **Allowed Personas**). We picked it over **Player Character** and **You**.
- **Q6. Player means only the person at the keyboard.** `player.*`, the variable menu's **Player** group, and hints such as "the player picks" stay as they are. Any label that names the character moves off "Player".

**Editor surfaces**

- **Q8. The Player Name chip becomes Persona Name.** **Character Name** pairs with it and doesn't change. The `{{user}}` token stays.
- **Q9. The chip's fallback words stay.** With no persona, the chip still reads "you" in an opening and "the player" elsewhere. Only the AI reads these words, so no probe is needed.
- **Q10. The relationship target reads Persona.** Its role input is named **Persona's Role**, and **Persona** heads the **Add a relationship** list. The AI line still uses the picked persona's name: "Ash is Rowan's son".
- **Q11. The requirement owner reads Persona.** In the editor the text reads "Persona: Elf". The **Playing As** condition keeps its name. Ticket 04 intent answers:
  - Under None with a Custom Persona entity, play shows that entity's entered name plus the pill. Only with no played owner at all does play show "Persona".
  - Under a library persona with a Custom Persona entity, play shows the played persona's name and one pill, never both names.
  - Every author surface keeps "Persona", the Test Bench included, even when its lens plays a persona. Only the player's surfaces (Traits tab, Enter World) get the name plus the pill.
- **Q12. The opening preview reads "Turn one as Kate", or "Turn one with no persona".** The persona select's hint reads "Sets the persona". "The default character" goes. The name comes from the persona picked in the select, not from the lens PC trait. "With no persona" shows when the select is None or the world has no personas (ticket 07 intent answer).
- **Q13. The code card's persona line reads "Persona: Playable".** It matches the **Persona** control's choice. In the glossary, the owner **You** becomes the owner **Persona**.
- **Q15. "Lens PC" becomes "Lens Pick".** The **Active Traits** note reads "defaults plus the lens pick". Reopened by ticket 07: the badge marks the Test Bench lens's picked trait, not the persona, so "Lens Persona" would mislead.
- **Q17. The Persona Name chip keeps "player name" as a search term.** Authors who search the old label still find it.
- **Q20. The author-note ⓘ line says "not something your persona says".** It no longer says "your character".

**Docs and help**

- **Q16. The wiki heading becomes "The Persona Name Chip".** The anchor fixture and every link to the old anchor change in the same commit.
- **Q18. Editor-side wiki text names the owner Persona.** This covers every editor-side page that names this owner: World Editor Traits, World Editor Entities (image visibility rules), and the Glossary's **Owner** row. In-game pages keep "marked **You**", because that matches the pill.
- **Q19. The commit that renames the docs also rebuilds the help search index.** That way, help search answers with the new words as soon as the change lands.

**Scope**

- **Q14. One spec covers both sides.** It holds the in-game pill and the editor wording, and its tickets split by surface.

## User Stories

**Players**

1. As a player, I want my persona's row in the **Entities** tab to carry the You pill, so that I find myself at a glance.
2. As a player, I want the persona row above **Stats**, **Traits** and **Location** to show the You pill after my persona's name, so that the row reads as me.
3. As a player, I want my persona's stat section heading to carry the You pill, so that I tell my stats from an entity's.
4. As a player, I want my persona's category in the **Traits** tab to carry the You pill, so that I know which traits are mine.
5. As a player, I want the Enter World trait categories and entity heading to carry the You pill, so that I see which entity I'll play before I start.
6. As a player, I want the pill on a selected Enter World row to stay readable on the primary fill, so that it doesn't vanish when I select the row.
7. As a player, I want the same pill everywhere, so that I learn one cue.
8. As a player, I want the pill to line up with my persona's name, so that it reads as part of the row and not as a stray badge.
9. As a player on mobile, I want the pill on the **Status** and **Character** tabs, so that the cue holds on a small screen.
10. As a player in light theme, I want the pill to keep its contrast, so that I can read it.
11. As a player with a colored palette, I want the pill to take the palette's primary color, so that it matches the rest of the app.
12. As a player who picks the Custom Persona, I want the pill after the name I typed, so that my own entry gets the same cue.
13. As a player who plays a library persona, I want the pill on that persona, so that the cue doesn't depend on where the persona came from.
14. As a player who picks **None** with no Custom Persona, I want no pill and no empty badge, so that nothing points at an entity I don't have.
15. As a player who changes persona mid-game, I want the pill to move to the new persona, so that it always marks who I play now.
16. As a player under None or a library persona, I want each played owner marked, including the Custom Persona entity, so that I know both sets of traits are mine.
17. As a player using a screen reader, I want the pill read as "You" after the name, so that I hear the same cue.
18. As a player, I want a requirement on my own traits to read "Kate [You]: Elf", so that I see whose trait it checks.
19. As a player reading the **Entities** help topic, I want it to describe the pill, so that the help matches the screen.
20. As a player choosing an entity in the stats panel picker, I want my persona marked in the list, so that I find my own stats.
21. As a player reading the author-note ⓘ line, I want it to say "your persona", so that it uses the same word as the rest of the app.

**Authors**

22. As an author, I want a relationship to target **Persona**, so that I know it means whoever the player plays.
23. As an author, I want the role input named **Persona's Role**, so that a screen reader names the row the same way.
24. As an author, I want a requirement owner named **Persona**, so that "Persona: Elf" reads as "the played entity has Elf".
25. As an author, I want **Playing As** to keep its name, so that I tell "which persona" apart from "the persona's trait".
26. As an author, I want the built-in chip named **Persona Name**, so that its name says what it becomes.
27. As an author who learned **Player Name**, I want a search for "player name" to find the chip, so that the rename doesn't hide it.
28. As an author, I want `{{user}}` to keep working, so that imported cards and my typing habits still turn into the chip.
29. As an author, I want the opening preview to say "Turn one as Kate" or "Turn one with no persona", so that I see which persona the draw used.
30. As an author, I want the Openings test tool to say **Lens Pick** for the trait the lens picked, so that no character word sits on a trait.
31. As an author, I want the code card to say "Persona: Playable", so that it matches the **Persona** control.
32. As an author, I want `player.*` and the variable menu's **Player** group unchanged, so that "Player" still means the person I ask a question.
33. As an author reading the wiki, I want the editor pages to say **Persona** where the editor says it, so that the docs match the screen.
34. As an author following a link to the chip's wiki section, I want it to land on the renamed heading, so that no link breaks.
35. As an author asking the help window about the chip, I want answers that use **Persona Name**, so that help matches the editor.

**Maintainers**

36. As a designer, I want the pill in the Design System guide and showcase, so that new surfaces reuse it and don't invent another mark.
37. As a maintainer, I want the glossary to name the owner **Persona**, so that code, docs and UI share one word.

## Implementation Decisions

**The You mark (in game)**

- **One shared component.** It renders the pill and takes one option, `onFill`, for a row on the primary fill, which inverts the colors. It takes no variant and no name, because the host renders the name.
- **The mark sits in a box one line tall.** That box centers the pill on the host's line, in flex hosts and in inline, wrapping hosts alike. The code below comes from the prototype:

  ```tsx
  <span className="ml-1.5 inline-flex h-[1lh] shrink-0 items-center align-top">
    <span className="inline-flex h-3.5 items-center rounded-full px-1 text-[9px] font-semibold leading-none
                     bg-primary text-primary-foreground /* onFill: bg-primary-foreground text-primary */">
      You
    </span>
  </span>
  ```

- **In-game surfaces:**
  - **Entities** tab row: the row takes a flag for the played persona and renders the mark after the name. The `(You)` text leaves the label.
  - Persona row in the side panel: the mark goes after the name. **None** shows no mark.
  - Stats panel: the mark goes on the heading of each played owner's section.
  - **Traits** tab: the mark goes on the entity sub-heading and on each played owner's section heading. The section's accessible name keeps its ", You" part.
  - Enter World: the mark goes on the trait category list, with `onFill` on the selected row, and on the entity heading.
  - Stats panel picker: try the mark inside the select item. Keep the `(You)` text if the trigger or the item renders it poorly.
  - Requirement text in play: the owner shows as the persona's name plus the mark.
- **Who gets the mark doesn't change.** Each surface keeps its current rule for the played owners: the played persona, and the Custom Persona entity under None and under a library persona.

**Editor wording**

- **Labels change. Ids stay.** The relationship target id `you` and the requirement owner kind `you` stay in stored data. Only the labels that render them change.
- **The requirement text has two forms.** In the editor, the owner part reads **Persona**. In play, it reads the name plus the mark. The text builder needs a way to know which side it serves.
- **The built-in chip.** Its label becomes **Persona Name**, and its search terms gain "player name". The token, the fallback words and the Character Name pairing stay. The comment-level references to "Player Name" in code follow the label.
- **The Openings test tool.** Its preview line, the select's hint, the lens badge and the **Active Traits** note change as Q12 and Q15 say.
- **The code card.** The persona line's value reads **Playable**.
- **The author-note ⓘ line.** It reads "your persona".

**Docs, help and glossary**

- In-game docs say the persona is marked **You**, not **(You)**. This covers the **Entities** help topic and the Entities wiki page. Pages that already say "marked **You**" stay.
- Editor-side docs name the owner **Persona**: World Editor Traits (the owner step, the **Whose Trait Counts** text and its table row) and the Glossary's **Owner** row.
- The built-in chip docs name it **Persona Name**: Persona Authoring, World Editor Placeholders, World Editor Entities, World Editor Openings, the Glossary, Home, and the Design System's Built-in chips section.
- The Persona Authoring heading, the anchor fixture and every inbound link change together.
- The glossary in CONTEXT.md names the owner **Persona**.
- The help search index is rebuilt in the commit that renames the docs.
- Released changelog entries stay as they are. The relationships entry in 🚧 In Progress folds in **Persona** in place of **You**. A fragment can't edit an existing line, so the spec session rewords that entry on main after ticket 05 lands.

**Design System**

- A new section names the You pill, says where it goes (after the played persona's name, in game) and where it doesn't (editor surfaces, which say **Persona**).
- The showcase gets a production-backed reference with the pill on a plain row and on a selected row.
- The section's production mapping grows in one edit, made by the spec session after 02, 03 and 04 land. The tickets leave that table alone, so their rebases don't collide.
- The `onFill` inversion is a color only, so static frames of a selected and an unselected row prove it. No test checks class names.
- The Built-in Placeholder chips section names **Persona Name**.

**No export-shape change.** Nothing in a world or save file changes.

## Testing Decisions

- A good test renders the real surface and checks what the user sees: the persona's name followed by the You pill in game, or the word **Persona** in the editor. It never checks class names or the mark's internals.
- There is no new seam. Existing tests carry it:
  - The GamePanels render tests: the **Entities** row, the persona row, and the played owner's stat heading.
  - The TraitsTab tests: the played owner's sub-heading and section heading.
  - The Enter World workspace tests: the category list and the entity heading.
  - The stat panel entity list test: the picker label.
  - The relationship field tests: the **Persona** target and the **Persona's Role** input name.
  - The requirement and trait-gate tests: the owner reads **Persona** in the editor, and the name plus the mark in play.
  - The built-in placeholder tests: the label **Persona Name**, and a search for "player name" finds it.
  - The opening instrument tests: the preview line with and without a persona, and the lens badge.
  - The wiki anchor test: the renamed heading resolves, and no link points at the old anchor.
- Tests that find the persona by `(You)` or by the label **You** move to the new text.
- Prove each guard bites: put the old behavior back on one surface and watch its test fail.
- Visual checks run through the dev-router fixture: dark and light theme, one colored palette, and mobile (375 px) on the **Status** and **Character** tabs.

## Out of Scope

- **Concept labels stay:** **Change Persona**, the **Persona** category, **Your Personas**, **Set as Default Persona**, **Allowed Personas**, **Starts On**, and the role names **Cast**, **Playable**, **Persona-Only** and **Custom Persona**.
- **AI-facing words stay:** the `Player Character` header and key, the chip's fallback words, and any other prompt text.
- **Code-facing names stay:** `persona.*`, `player.*`, and the `{{user}}` and `{{char}}` tokens.
- **Seen during the work, but separate:**
  - The mobile **Character** tab and the entity-discovery status label **Character** both break the "entity, never character" rule.
  - The mobile **Entities** tab strip labels overlap at 375 px.

## Further Notes

- **Prototype:** branch `prototype/you-mark`, commit `5f04d053e`, preview entry `proto-you-mark` on port 5260. It holds three variants behind `localStorage['proto.youMark']` (`text`, `pill`, `icon`).
- **Evidence:** `.scratch/you-mark/` in the prototype worktree, frames 1–9:
  - 1–3: the three first variants
  - 4: the smaller pill
  - 5: the icon-only mark on hover
  - 6: light theme
  - 7–8: the mobile **Status** and **Character** tabs
  - 9: the Purple palette in dark
