# 07: Import SillyTavern Greetings As Opening Narration

Status: ready-for-human
Status note: built in 968f18a0, b97059b6 and the review fold 6f32346b
Base: 1a1a26dc
Blocked by: 03, 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Openings](../spec.md)

**What to build:** A player imports a SillyTavern card and the entity arrives with its greetings. The first message and each alternate greeting become Opening Narration rows on the entity, at equal weight, in card order. Page one then reads the way the card's author wrote it, and page-one regenerate works like a greeting swipe. A card with no greetings imports exactly as before.

**Rationale for the model:** a small, well-tested importer with a clear mapping. Sonnet at medium effort.

## Acceptance criteria

- [x] The importer reads the first message and the alternate greetings from V1, V2, and V3 cards. Each non-blank entry becomes one Narration row at weight 1, in card order.
- [x] The name macro becomes the entity's name in openings.
- [x] The user macro stays in the stored opening text and is not resolved. Import writes every spelling of it, such as a capital letter or inner spaces, as the one canonical form `{{user}}`. That form is the contract the Player Name chip of the Persona spec adopts, so one pure module exports it as a constant. The description fields keep today's macro handling.
- [x] At draw time the marker renders as "you", after chip resolution, at every draw site. The match is case-insensitive and allows inner spaces, so a hand-typed marker works too. It renders as "You" at the start of the text, at the start of a line, or after a period, a question mark, or an exclamation mark, with opening punctuation such as a quote or an asterisk allowed in between. Verb agreement is not corrected.
- [x] The legacy V1 macros `<USER>` and `<BOT>` stay out of scope, as they are for descriptions today.
- [x] The stored marker survives an entity card export and import unchanged.
- [x] The editor shows the stored marker as written, so the author can see and keep it.
- [x] A card with no first message and no alternate greetings imports as it does today, with no openings.
- [x] Both import entry points, the library and the World Editor, get the rows.
- [x] Importer tests cover each card version, order, blank entries, both macros, and the no-greeting card. One guard is proven by reinstating its fault.
- [x] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

Example dialogue, card prompt overrides, and the player name stay out. The player-name spec from another session later resolves the stored marker to the player's name. No new export-shape change beyond ticket 04.

## Comments

- **Built.** `src/lib/userMacro.ts` owns `USER_MACRO`, `USER_MACRO_RE`, `canonicalUserMacro` and `renderUserMacro`. The importer is `src/lib/tavernCard.ts`. GameViewer renders at the seed draw, the page-one redraw and the START GAME cue. Ticket 08 wraps both Test Bench lens sites in 35c73e85.
- **Beyond the rulings.** The review found that `{{user}}'s` rendered as "you's". The render now reads the possessive as "your", or "Your" at a sentence start.
- **Proof.** The canonical-form guard went red with the fault reinstated. The possessive test went red before its fix. A live check on the `pickedOpening` fixture with a temporary `{{ User }}` text filled the input box with `You waves to the courier. "You!" she calls to you.`
- **Not covered by a test.** No automated test pins the three GameViewer call sites. The live check covers the seed draw only.
- **Gates.** Typecheck 0 errors, lint 0, 11071 tests passed in 82 s wall, build green.
- **Known limit.** "Mr. {{user}}" renders "Mr. You", because the rule reads any period as a sentence end.
