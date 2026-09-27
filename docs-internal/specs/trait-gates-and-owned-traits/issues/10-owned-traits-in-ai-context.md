# 10: Owned traits in AI context

Status: ready-for-human
Base: d18020f0
Blocked by: 08 — Enter-world cast pages
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a prompt-text change that needs A/B probes on both model tiers per the prompt-writing guide.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

The story treats each NPC as the player shaped it, and treats the player as the entity they play.

## Acceptance criteria

- [x] An NPC's active owned traits join its full entity context, each AI description under the trait's name.
- [x] The NPC's summary gets one "Traits: …" line of names.
- [x] The played entity's active owned traits join the player's trait context beside the world traits.
- [x] The change follows the prompt-writing guide: A/B probes on both tiers, at least two runs per case, before/after metrics, and an other-metric regression check, reported in the response.
- [x] Context builder tests cover the three lines.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [x] State every export-shape change in the response.
- [x] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.

## Comments

**Probe results (2026-09-27)**, `testing/baseline/harness/owned-traits-probe.cli.ts`. Cloud ran 12 runs per arm per case; Cydonia 24B Q4 ran 3. Uptake is `before → after`.

| Case | Cloud | Cydonia |
|---|---|---|
| NPC song in narration (full chip) | 0/12 → 10/12 | 1/3 → 2/3 |
| NPC limp in narration (full chip) | 0/12 → 1/12 | 0/3 → 1/3 |
| NPC limp in planner (summary names only) | 0/12 → 12/12 | 0/3 → 2/3 |
| NPC song in planner (summary names only) | 0/12 → 2/12 | 0/3 → 2/3 |
| Player-owned scarf, all narration | 0/36 → 7/36 | 0/9 → 1/9 |
| Label leak (`traits:` or trait names) | 0 in every case | 0 in every case |

- The limp shows in narration mostly as indirect detail ("his injured knee", "a careful shift of his balance"), which the regex misses.
- **Name leak.** Cloud rose 0/12 → 4/12 for the eel-smoker. The cause is trait text that opens with her name. With `--unnamed` it was 2/12 → 1/12. So the leak comes from author text, not from the traits block.
- **Length.** Cloud length stayed flat (±5 words). Cydonia was mixed. The same `before` arm moved 95 → 134 words between two identical runs, so Cydonia is not deterministic at 2 parallel slots.

**Ruling applied (spec session, ee47f78c).** An owned trait's text uses its owner as `{{char}}`, and the trait's own pins apply. This covers the AI and the in-game Traits tab card.

**Review follow-ups not done here:**
- The tool lookup (`toolSnapshot`) and the staged-planning blurb (`entityBlurb`) still read entity descriptions without traits.
- The World Editor preview shows each entity's `isDefault` owned traits without settling gates.
- `PlaceholderSessionContext` priming skips owned trait text (reported by ticket 09).
- The summary line reads `traits:` in lowercase, which matches the roster's other field keys.
