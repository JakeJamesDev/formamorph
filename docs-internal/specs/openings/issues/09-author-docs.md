# 09: Author Docs For Openings

Status: ready-for-agent
Blocked by: 03, 04, 07
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

**Parent:** [Openings](../spec.md)

**What to build:** A world author or an entity author reads the wiki and learns how openings work: the two kinds, weights and chances, weight 0, the world switch, how entity openings join the pool, how a picked entity wins, and what the SillyTavern import brings in.

**Rationale for the model:** the docs define terms that the UI copy depends on, and the writing standard is exact. Opus at medium effort. The session writes the pages itself and does not hand them to a smaller model.

## Acceptance criteria

- [ ] The world authoring page explains Opening Action and Opening Narration, with a table that says where the text lands and who writes page one.
- [ ] It explains weights, chances, weight 0, the list switch, and the default opening.
- [ ] The entity authoring page explains entity openings, the starting-location rule, and that openings travel with the entity card.
- [ ] The play or Enter World page says that a picked entity's openings win, and that page-one regenerate draws another opening.
- [ ] The import page says that a SillyTavern first message and alternate greetings become Opening Narration rows, and that the user marker shows as "you".
- [ ] The pages use the defined terms only. "Cue" and "scripted" do not appear. An entity is never called a character.
- [ ] The pages are short sections, tables, and callouts. They name no version and do not mention agent-only files.
- [ ] Old text about the single opening cue is replaced, not left beside the new text.
- [ ] Lint and build pass. The wiki publishes on merge; do not touch the wiki UI.

## Scope notes

Docs only. No code, and no changelog entry beyond those the feature tickets add.
