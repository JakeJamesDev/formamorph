# 03: Persona Chip in the Prompts

Status: ready-for-human
Base: f43219d7
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

## Comments

### Probe numbers (2026-09-18)

`testing/baseline/harness/persona-probe.mjs`, one identity both ways: **A** = the base prompts (`f43219d7`) with the player named in a trait; **B** = the new prompts with the same name, pronouns and description as a persona, traits empty. Means per run; flags are rates.

**Cloud default endpoint** (narration 18 runs/arm, choices/summary 12, director/thinking 12):

| Stage | Metric | A | B |
|---|---|---|---|
| Narration | stranger says the player's name | 0 | 0 |
| Narration | narrator names the player outside a quote | 0 | 0 |
| Narration | name on page when the action states it | 3/3 | 3/3 |
| Narration | NPC spoke | 0.67 | 0.72 |
| Narration | PC re-description tic / words | 0.11 / 80.4 | 0 / 80.0 |
| Choices | lines start with "I" / name in options | 1.00 / 0 | 1.00 / 0 |
| Summaries | second person / name in digest | 1.00 / 0 | 1.00 / 0 |
| Director | Cast opens with Player Character | 1.00 | 1.00 |
| Planning | Cast opens with Player Character | 1.00 | 1.00 |

**Cydonia 24B** (LM Studio, seeded per run; narration 12/arm, choices/summary 8, director/thinking 20):

| Stage | Metric | A | B |
|---|---|---|---|
| Narration | stranger says the player's name | 0 | 0 |
| Narration | narrator names the player outside a quote | 0 | 0 |
| Narration | name on page when the action states it | 2/2 | 2/2 |
| Narration | NPC spoke | 1.00 | 1.00 |
| Narration | PC re-description tic / words | 0.92 / 120.7 | 0.75 / 104.3 |
| Choices | lines start with "I" / name in options | 1.00 / 0 | 1.00 / 0 |
| Summaries | second person / name in digest | 1.00 / 0 | 1.00 / 0 |
| Director | Cast opens with Player Character | 1.00 | 1.00 (0.95 before the fix below) |
| Planning | Cast opens with Player Character | 1.00 | 1.00 |

**One iteration.** The first B placed the persona section in the director and planner with no Cast guidance. Cydonia then wrote the persona's name as the first Cast bullet in place of `Player Character` (2 of ~30 distinct director samples; A 0). The planner's player-name list from ticket 02 still reads that bullet as the player, but it breaks the prompt's contract. The fix is a positive line in the placement's suffix, `In the Cast, this is Player Character.`, which vanishes with no persona. Same seeds after the fix: director 20/20, planner 20/20.

**Read.** No metric regressed on either tier. The stranger-name and third-person metrics sit at 0 in both arms, so the extended learned-name rule shows no measurable gain at this sample size. It is a guard, and it costs nothing when no persona is set. Cydonia's length dropped 14% in B, inside the noise of 12 runs; cloud length is flat.

### Build notes

- The heading rides in the chip's prefix (spec session ruling, route A). The affix field shows a newline as ↵ and Enter adds one. `restyle` masks tokens during the header pass and restyles headings inside affixes; in XML the affix opens and closes its own tag, nested in the section before it, so the no-persona render stays byte-identical in all three presets.
- Coverage is proven at the render seam, not the Test Bench (spec session ruling): `GamePrompts.persona.test.ts` writes the spec's table out and renders every built-in preset. `personaContext.ts` and `sectionStyle.ts` are at 100% line and branch coverage; every guard was mutation-checked.
- `buildContextValues` in GameViewer is not unit-tested (the view is too large to mount); the preview Settings editor showed the chip, its axes, the ↵ affix, and the rendered persona section on the sample values.

### Review follow-up

- **Placements without a Traits block.** Summaries, Milestone Select and Diary have no context sections, so the Name chip rides inline at the end of their first paragraph or bullet (`The player is …`). Scene Tags has no headings either; its Full block follows a lead-in line (`The passage calls this person you:`) instead of a heading, so the prompt stays heading-free.
- **The Cast-label suffix** in Director and Planning is prompt text the spec did not ask for. It came from the probe iteration above and renders only with a persona. The spec session can veto it.
- **No-persona identity, all presets.** The render-seam test compares each preset with its own chips removed. The base-commit comparison was also run once for all 90 renders (30 prompts × Default, Simple, XML, old `sectionStyle` on old prompts vs new on new): identical. It is not kept as a test, because it pins the whole prompt text and any later prompt edit would break it.
