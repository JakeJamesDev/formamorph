# 09: Author Docs For Openings

Status: ready-for-human
Status note: built in 84cc44b9 with the review fold; one criterion is partial, see Comments
Base: 3bd7bca5
Blocked by: 03, 04, 07
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

**Parent:** [Openings](../spec.md)

**What to build:** A world author or an entity author reads the wiki and learns how openings work: the two kinds, weights and chances, weight 0, the world switch, how entity openings join the pool, how a picked entity wins, and what the SillyTavern import brings in.

**Rationale for the model:** the docs define terms that the UI copy depends on, and the writing standard is exact. Opus at medium effort. The session writes the pages itself and does not hand them to a smaller model.

## Acceptance criteria

- [x] No new wiki page and no sidebar change. The text goes where the author or the player already looks.
- [x] The World Editor page gets an Openings section in place of its Opening Cue section, under Overview. It explains Opening Action and Opening Narration, with a table that says where the text lands and who writes page one.
- [x] That section explains weights, chances, weight 0, the list switch, the default opening, and the mirrored panel: the owner groups, the starting location picker, and the dash for an entity that is elsewhere.
- [x] The Entities part of the World Editor page gets a short Openings subsection: the Openings tab, the starting-location rule, and that openings travel with the entity card. It links to the Openings section and does not repeat it.
- [x] The same Entities part gets a SillyTavern import subsection beside the character card text. It says that the first message and alternate greetings become Opening Narration rows, and that the user marker shows as "you".
- [x] The Entities in Play page gets a short section on how a game opens: a picked entity's openings win, and page-one regenerate draws another opening.
- [x] The World Format page replaces the old opening cue fields with the new openings fields on the world and on the entity.
- [ ] The pages use the defined terms only. "Cue" and "scripted" do not appear. An entity is never called a character.
- [x] The pages are short sections, tables, and callouts. They name no version and do not mention agent-only files.
- [x] Old text about the single opening cue is replaced, not left beside the new text.
- [x] Lint and build pass. The wiki publishes on merge; do not touch the wiki UI.

## Scope notes

Docs only. No code, and no changelog entry beyond those the feature tickets add.

## Comments

- The terms criterion is partial on the Entities in Play page. The new section is clean. The older sections still say "character" for story-invented entities, and two real setting labels use the word (**Describe New Characters**, **Character Diaries**). A reword of that page is outside this ticket.
- The review found three places where the shipped code differs from the spec. The docs describe the code:
  - A row with blank text shows 0% and never draws. The spec says 0% means weight 0 only.
  - The world panel makes a group only for an entity that has openings. The spec says one group per authored entity.
  - A SillyTavern card with alternate greetings and no first message still imports openings. Story 28 covers only a card with neither.
