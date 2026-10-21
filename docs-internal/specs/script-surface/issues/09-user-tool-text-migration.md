# 09: User Tool Text Migration

Status: ready-for-agent
Blocked by: 02, 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a rewrite of shipped user text that must be exact where it runs and must leave everything else untouched and visibly flagged.

## What to build

On settings load, every user Tool script and Formaquestion Tool script passes through the rewrite pass from ticket 02 with the exact-equivalent table (spec: Surface, Migrations): `world.entities`, `world.locations`, `world.dictionary`, `scene.location.<member>`, `scene.time.elapsed`, `scene.stats.X`, `scene.present`, `scene.inScene` and `scene.notes` become their new forms. Bare `scene.location`, bare `scene.time`, `scene.traits`, `scene.persona` and a read of an entity item's resolved `placeholders` stay as written, and the editor marks them unknown with a hover card that names the new form (Q28). The pass is idempotent and the settings shape does not change. Tool pack import runs the same pass.

Spec: Q1, Q28, story 17.

## Acceptance criteria

- [ ] A fixture Tool script using every row of the table loads rewritten and runs with the same text result over one snapshot as before the migration; loading it again changes nothing
- [ ] A fixture with `scene.traits` and a bare `scene.time` check loads unchanged, and the editor's card on each names the new form
- [ ] A Tool pack imported with old text is rewritten the same way
- [ ] Four gates green

## Blocked by

- 02 (Diary On Entities And The Rewrite Pass)
- 08 (User Tool Convergence)
