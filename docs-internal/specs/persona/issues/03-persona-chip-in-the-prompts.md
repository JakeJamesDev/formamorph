# 03: Persona Chip in the Prompts

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Persona](../spec.md)

**What to build:** The `<PERSONA>` chip carries the persona into the prompts. It has a detail axis with Full, Summary, and Name, plus the shared format axis, and it is affixable. The default presets place it per the spec's coverage table, in the stable block beside Traits and above Location. The narration prompt keeps second person, and its learned-name rule extends to the persona's name.

**Rationale for the model:** this is prompt text for small models plus an A/B probe run and its reading. A strong model at high effort.

## Acceptance criteria

- [ ] The chip joins the shared context chips and the chip vocabulary. Full and Summary reuse the entity context builder. Name renders the name and pronouns only.
- [ ] With affixes, no persona renders the whole placement as nothing, header included. Builder tests cover each detail and format variant and the empty render.
- [ ] Default coverage matches the spec table: Full in narration, thinking, director, storyboard, character, and scene tags; Name in choices, summary, milestone, and diary; absent elsewhere.
- [ ] The Default, Simple, and XML built-in presets all carry the chip, derived from the one canonical source.
- [ ] Chip presence is read through the template parser, never by substring.
- [ ] The AI-context builder of the Test Bench proves the persona appears in the covered prompts and is absent from the rest.
- [ ] With no persona set, every default prompt renders the same text as before this ticket. A test proves it.
- [ ] The prompt edits follow the prompt writing guide. No example names appear. An A/B probe runs on both reference tiers with at least two runs per case, with before and after numbers and a regression check on the other metrics. The numbers go in the ticket's comments.
- [ ] The settings prompt editor shows the chip with its axes, checked in the preview through the dev-router.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

Hard cutover, as with earlier chips: a custom preset or a world prompt override gets no persona until its author adds the chip. The known-person line for world personas belongs to ticket 06. Settings only; no export-shape change.
