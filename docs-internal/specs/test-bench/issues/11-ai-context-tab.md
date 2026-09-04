# 11 — AI Context tab

**What to build:** Pick a place in the lens; see exactly what the harness serves from there. A pure
view-model assembles, for the lens location: every context block the prompts can include (world
description, location, entities, sub-locations, parent, reachable, destinations, dictionary, stats)
with its rendered value and ~token estimate, plus a "a turn from here ≈ ~N" total; the navigable
destinations with each one's travel hint, presented as the complete closed set — with the UI stating
that anything not listed can never be traveled to, and that whether an action counts as travel is
the model's judgment (ADR-0005); the entity rosters per scope (here / sub-locations / reachable)
flagging whether each entity arrives as full description or summary. Values resolve through the
lens PC's pins. Blocks expand to show their rendered text.

**Blocked by:** 10 — Lens bar.

Status: done

- [x] View-model is pure and tested: location in → blocks, destinations, rosters, estimates out
- [x] Rendered block text identical to what the game's builders produce for the same inputs
- [x] Destination list matches effective navigation (Connections replacing implicit links, one-way honored)
- [x] Summary-vs-full flag correct for items carrying an AI summary
- [x] All token figures ~-prefixed; total equals the sum of shown blocks

**Notes:** the Traits block was added to the enumerated set — the ticket's clause is "every context
block the prompts can include", and a per-turn total that omits Traits understates the cost. Each
block's content/format options are decoded from the shipped default prompts' own token
(`<LOCATION|sublocations.summary.markdown>` etc.), so a block can never render in a shape no prompt
asks for; prompts are a global setting the editor cannot read, which is what makes the defaults the
only honest stand-in.
