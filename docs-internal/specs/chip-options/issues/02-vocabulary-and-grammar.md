# 02: Vocabulary And Grammar

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the token grammar sits in saved presets and bundled worlds; a parser change that drops an old spelling blanks chips silently, so this needs care and broad tests.

Parent: [Chip Options spec](../spec.md)

## What to build

The prompt variable registry gains the new pieces on the Entities and Persona chips, and the token parser stops enumerating every option combination.

- New toggle axes: Only With Stats, Only With Traits, Include Traits (on by default, the stored id is the off state), and the three Stat Detail pieces Range, Descriptor, Description (on by default, stored ids are the off states). Their ids are distinct from the Stats chip's on-ids. The existing Entities stats toggle keeps its ids; the Sub-Locations and Reachable scopes gain a positive stats-on id so a bare token stays stat-free there (Q24).
- The registry gains an explicit lock group on toggle axes. The Stats chip's pieces form one group; the Entities Stat Detail pieces and the Persona Stat Detail pieces form their own. Only With, Include and the stats toggle belong to none. The dialog enforces the group in ticket 05.
- The parser accepts any dotted combination of ids known to the token's base, in any order. Two ids from one axis or a repeated id decode last-wins. An unknown id, or an id valid only for another base, leaves the token as text.
- Decode and encode handle the new ids. Encode writes ids in registry order. An unchanged selection encodes to the bare token.
- Ticket 01's value lookup accepts a key only in canonical axis order. A parsed token's key is normalized through decode and encode before lookup, so an any-order spelling renders instead of falling through as raw text.
- Every spelling in a default prompt or a bundled world parses to the same selection as before, affix, format and header segments included.
- None of the new ids joins the chip label's pick list (Q27).
- Until ticket 03 lands, the renderer ignores the new ids. A token that carries one still renders its base value.

Rulings: Q4, Q7, Q8, Q13, Q24, Q27.

## Acceptance criteria

- [ ] Every default prompt token and every bundled world token parses to the same selection as before.
- [ ] A token with the new ids round-trips through decode and encode byte for byte.
- [ ] A token with ids in a different order decodes to the same selection; a repeated id decodes last-wins.
- [ ] An unknown id leaves the token as plain text.
- [ ] The chip label for a token with only new ids reads as the bare token's label.
- [ ] A token with a new id renders its base value in a live turn.
