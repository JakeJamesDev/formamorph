# Spec: AI Context Reads Settled Starting Stats

Status: ready-for-agent
Status note: no tickets; the spec is the unit. Found by the Authoring Tour's ticket 08. The user chose to fix it in the Test Bench, outside the tour, on 2026-09-23.

## Problem Statement

The Test Bench has two instruments that show stats for a fresh game:

| Instrument | Stat value it uses |
|---|---|
| **Opening** | The settled starting value: seeded, trait changes applied, clamped. This is the real turn-one number. |
| **AI Context** | The value written in the editor, with no trait changes applied. |

The two disagree whenever a trait in force changes a stat. That includes a trait on by default, and the lens character's own trait. The AI Context instrument then shows the AI a stat block that no real game sends. For example, a stat written as 0 with a default trait of +15 shows as `0/100` in AI Context, but a new game starts at `15/100`. The stat's descriptor band can differ too.

The Test Bench's rule is that it shows exactly what play computes (ADR-0005). This gap breaks that rule.

## Solution

The AI Context instrument's stats block uses the same settled starting values as the Opening instrument, for the same lens. With no trait in force that changes a stat, nothing changes.

## User Stories

1. As an author with a default trait that changes a stat, I want AI Context to show the stat at the value a new game starts with, so that I see the stat block the AI really gets.
2. As an author who picks a lens character, I want that character's trait changes applied to the stats in AI Context, so that switching the lens shows how the AI's view changes.
3. As an author, I want AI Context and Opening to agree on every stat value, so that the two instruments never contradict each other.
4. As an author whose trait change would push a stat past its bounds, I want AI Context to show the clamped value, as play does.
5. As an author whose lens switches a stat off, I want that stat still left out of AI Context, as today.

## Implementation Decisions

- **One settling path.** AI Context takes its stat values from the Opening instrument's settling, which runs the game's own trait runtime, with the same active traits the lens already uses. It gets no settling code of its own.
- The stat switch-off filter is unchanged, and runs after settling.
- The descriptor band follows the settled value, because the one stat-context builder picks the band from the value it is given.
- **No world or save export-shape change.** Test Bench state stays local.
- **Branch note:** the `feature/authoring-tour` branch already has a helper that returns the Opening's settled stats (`settledOpeningStats`). Use that name and shape on `main`, so the later merge is trivial.

## Testing Decisions

- Test through the instruments' pure data modules, as their existing tests do. Assert the rendered stats block, not internals.
- A world with a default trait that adds to a stat: AI Context shows the settled value, and it equals the Opening instrument's value.
- A lens character whose trait changes a stat: switching the lens changes the AI Context value.
- A change that would pass the maximum shows the clamped value.
- A lens that switches a stat off still omits it.
- Guards must bite: put the authored value back and watch the tests fail.
- Prior art: the AI Context and Opening instrument tests, and the lens tests.

## Out of Scope

- Stat values after turn one. AI Context stays a fresh-game view.
- The Authoring Tour's Stats step. It shows the value written in the editor, which is the same as the settled value in the tour's world. See Further Notes.

## Further Notes

- After this fix is merged into `feature/authoring-tour`, the tour's Stats step readers will read settled values through AI Context. Its Player Sees stat row should then use the settled value too, so the step stays consistent. The tour spec records this follow-up.
- Changelog: one 👤 Fixed entry in the In Progress section.
