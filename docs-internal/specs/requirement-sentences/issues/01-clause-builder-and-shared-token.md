# 01: Clause Builder and Shared Token

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The two shared pieces every later ticket uses. Nothing a player or author sees changes in this ticket.

**The clause builder.** One function in the gates module returns a Condition's clause as ordered parts: subject, verb, target, and the extras of its kind (comparison, value, item checks, set). Each part carries its text and its role, and the builder marks which part is broken when the Condition is unresolved. Joined, the parts are the plain clause.

- It covers every row of the spec's grammar table (Q20), each Not form (Q6, Q19), the four item verbs (Q21) and the comparison words (Q12).
- It takes a point of view. For the author: the owner's name, "the player" for the persona, and the Q11 subject for no owner (the host's name, else "This entity"). For the player: "you" with second-person verbs (Q18): "you have", "you don't have", "you own", "you are", "your Health is".
- The first word of a sentence takes a capital; a subject later in the sentence does not.
- The old rule text stays beside it. No reader moves in this ticket.

**The shared token.** The Entity Schedule's token (underlined text that opens a popover editor) moves to the shared UI components. The Routine view imports it from there and looks and behaves as before.

This ticket owns both pieces. Tickets 02 and 05 build on them and never make their own.

Three open points from the spec's Further Notes belong here. Send each to the spec session before the first edit:

- The subject for a Condition with no owner on a world trait ("The player", per the glossary).
- The text of an empty set (time, weather, Opening).
- Whether a repeated subject shortens to "its" or "their".

## Acceptance criteria

- [ ] The builder returns the grammar table's sentence for every Condition kind in the author's view, Not forms included; one pure test per kind, beside the existing gate text tests.
- [ ] The builder returns second-person clauses in the player's view for every kind that can name the persona.
- [ ] A Condition with no owner reads the host's name when one is given and "This entity" when none is.
- [ ] An unresolved Condition marks the broken part: a missing target, a missing owner, an empty set, a missing World Option value.
- [ ] The existing rule text and its tests are unchanged.
- [ ] The Routine view renders its tokens from the shared component; its existing tests pass unchanged.
- [ ] The Design System page lists the token as a shared component.
