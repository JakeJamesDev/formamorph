# 07: Import SillyTavern Greetings As Opening Narration

Status: ready-for-agent
Blocked by: 03, 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Openings](../spec.md)

**What to build:** A player imports a SillyTavern card and the entity arrives with its greetings. The first message and each alternate greeting become Opening Narration rows on the entity, at equal weight, in card order. Page one then reads the way the card's author wrote it, and page-one regenerate works like a greeting swipe. A card with no greetings imports exactly as before.

**Rationale for the model:** a small, well-tested importer with a clear mapping. Sonnet at medium effort.

## Acceptance criteria

- [ ] The importer reads the first message and the alternate greetings from V1, V2, and V3 cards. Each non-blank entry becomes one Narration row at weight 1, in card order.
- [ ] The name macro becomes the entity's name in openings.
- [ ] The user macro stays unchanged in the stored opening text. At draw time it renders as "you". The description fields keep today's macro handling.
- [ ] The stored marker survives an entity card export and import unchanged.
- [ ] The editor shows the stored marker as written, so the author can see and keep it.
- [ ] A card with no first message and no alternate greetings imports as it does today, with no openings.
- [ ] Both import entry points, the library and the World Editor, get the rows.
- [ ] Importer tests cover each card version, order, blank entries, both macros, and the no-greeting card. One guard is proven by reinstating its fault.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

Example dialogue, card prompt overrides, and the player name stay out. The player-name spec from another session later resolves the stored marker to the player's name. No new export-shape change beyond ticket 04.
