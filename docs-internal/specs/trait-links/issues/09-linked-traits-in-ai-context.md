# 09: Linked traits in AI context

Status: ready-for-human
Base: 93424d0d
Blocked by: 08 — Bearers at enter-world and in play
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: prompt-text changes over an existing owned-trait path, plus probe runs. Small code, careful measurement.

Parent: [Trait Links spec](../spec.md)

## What to build

The narrator knows Albus is a Paladin. A cast entity's active linked traits join its entity context like owned traits, and `{{char}}` in any trait's text names the bearer.

## Acceptance criteria

- [x] A cast entity's active linked traits join its entity context the same way as owned traits: full text in the full context, names in the summary. The played bearer's linked traits join the player's trait context.
- [x] `{{char}}` in a trait's text reads as the bearer's name. On the Custom Persona bearer under None it reads as the player name, as `{{user}}` does. The in-play trait card resolves the same way.
- [x] Roll priming walks linked trait names and descriptions per bearer.
- [x] The editor's AI-context preview (the authored chip scene) reads the player's traits through the resolver, so a default Templates trait no longer counts as the player's. Ticket 03 left this unowned.
- [x] Prompt changes follow the prompt-writing guide and ship with probe numbers against the cloud default, with in-batch controls.
- [x] Context tests cover a cast entity's linked trait in full and summary context, and `{{char}}` on a cast entity, a world persona and Custom Persona.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [x] State every export-shape change in the response.
- [x] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.

## Comments

**Rulings used (spec session):** Q89, `{{char}}` on the player bearer reads as `{{user}}` does, root traits included. Q90, priming walks each bearer's traits with bearer-relative pins bound.

**No prompt template changed.** Linked traits reach the AI through the owned-trait roster and Traits chip. `owned-traits-probe.cli.ts --linked` builds the probe's traits as Templates originals that each bearer links, with `{{char}}` for the owner's name, through `resolveBearers` and the authored scene. Its chips match the owned build byte for byte, so the owned-traits probe numbers (ticket 10 of trait gates) hold for links.

**Probe results (2026-09-28), cloud default, `--linked`,** 12 runs per arm per case. `before` is the in-batch control with no traits in force. Uptake is `before → after`.

| Case | Cloud |
|---|---|
| Cast entity song in narration (full chip) | 0/12 → 11/12 |
| Cast entity limp in narration (full chip) | 0/12 → 3/12 |
| Cast entity limp in planner (summary names only) | 1/12 → 11/12 |
| Cast entity song in planner (summary names only) | 1/12 → 1/12 |
| Played persona's linked scarf in narration | 0/12 → 1/12 |
| Label leak (`traits:` or trait names) | 0 in every case |

- **Name leak.** The eel-smoker rose 0/12 → 3/12, as in the owned run (0 → 4). The trait text names her once `{{char}}` resolves. The ferryman read 10/12 → 11/12: this batch's control arm already leaked his name, so the model drifted, not the traits.
- **Length and dialogue** stayed flat: every case within 12 words.
- Cydonia was not run: the cloud is the default target, and the chips are identical to the owned build that Cydonia already measured.

**Also fixed here, found by the tests:**
- The live Traits chip placed a Custom Persona pick under a "Templates:" header, since the scene used the world's groups. The player's traits now read their place from the player bearer's tree (Q83).
- Priming never walked owned trait text (the trait-gates review's follow-up). It now walks every bearer's trait and group names and descriptions.

**Review (0cc2afc6), folded in:**
- A linked trait's name on a cast entity read as the player in the Traits tab, and as nothing in the AI roster. Tab rows now name linked originals for their entity (`withBearerNames`), and the roster resolves trait and group names with their bearer.
- Player-bearer group text now reads `{{char}}` as the player (Q89), in both scenes.
- Priming binds the player's pins to every persona's placeholders, world ones too (Q77), and walks only entities' own text, not the world text twice.
- The pin-binding call is one helper, `bindForBearer`.

**User ruling (2026-09-28):** priming owned trait and group text stays in this ticket, past Q90's wording.

**Left for others:** the Test Bench's Opening and AI Context instruments pass their own resolution, so a linked trait there reads the lens pins, and `{{char}}` in a cast entity's trait reads as nothing in AI Context (ticket 11's area).
