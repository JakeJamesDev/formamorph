# 09: User Tool Text Migration

Status: done
Blocked by: 02, 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a rewrite of shipped user text that must be exact where it runs and must leave everything else untouched and visibly flagged.

## What to build

On settings load, every user Tool script and Formaquestion Tool script passes through the rewrite pass from ticket 02 with the exact-equivalent table (spec: Surface, Migrations): `world.entities`, `world.locations`, `world.dictionary`, `scene.location.<member>`, `scene.time.elapsed`, `scene.stats.X`, `scene.present`, `scene.inScene` and `scene.notes` become their new forms. Bare `scene.location`, bare `scene.time`, `scene.traits`, `scene.persona` and a read of an entity item's resolved `placeholders` stay as written, and the editor marks them unknown with a hover card that names the new form (Q28). The pass is idempotent and the settings shape does not change. Tool pack import runs the same pass.

Spec: Q1, Q28, story 17.

## Acceptance criteria

- [x] A fixture Tool script using every row of the table loads rewritten and runs with the same text result over one snapshot as before the migration; loading it again changes nothing — `toolTextMigration.test.ts` "loads rewritten, runs to the text it gave before, and a second load changes nothing"; the expected text was read from the 3.3.3 runtime (55d43ae39 builder) on the sample world
- [x] A fixture with `scene.traits` and a bare `scene.time` check loads unchanged, and the editor's card on each names the new form — "loads as written" and "is marked in the editor with the new form named (Q51)"; the card is the diagnostic's hover (Q51)
- [x] A Tool pack imported with old text is rewritten the same way — "rewrites a Tool pack imported with old text"; stored Formaquestion Tools too
- [ ] Four gates green

## Blocked by

- 02 (Diary On Entities And The Rewrite Pass)
- 08 (User Tool Convergence)

## Landed

**Not verified**

- Four gates green: the review gates (typecheck, changed-file lint) passed; prepare runs all four and lands only when they pass.
- The Tool editor live: the marks are proved through `codeDiagnostics`, not in the preview.

**For you**

- Settings → Tools → a Script Tool that reads `scene.traits`: the editor underlines `scene.traits` and the tooltip reads "Use “traits”."

**Migrations table, as built (for the spec)**

User Tool scripts, on settings load, rewrite only these rows:

| Old form | New form |
|---|---|
| `world.entities` | `Object.values(entities)`, only where no item leaves the script whole and no `.placeholders` or field the old item lacked is read (Q52) |
| `world.locations` | `Object.values(locations)`, under the same rule |
| `scene.location.id`, `scene.location.name` | `location.id`, `location.name` |
| `scene.time.elapsed` | `clock.elapsedHours` |
| `scene.stats.X` and `scene.stats["X"]` | `stats.X.value` and `stats["X"].value` |
| `scene.notes` | `notes` |

Flagged, not rewritten: bare `scene.location` and any other location member or `?.` read, bare `scene.time` and `scene.time?.elapsed`, bare or computed `scene.stats`, `scene.traits`, `scene.persona`, `scene.present` and `scene.inScene` (Q50), `world.dictionary` (Q55), and a `world.entities` or `world.locations` read that fails Q52. A rewrite into a name the script declares stays as written too.

**Notes for later tickets**

- `world.entities` lists the persona's entry when it is a library or Custom entity (Q50, accepted).
- The rewrite runs in `parseTool`'s user path, so preset import and the help preset file take it too. It reads the world pass at call time because of an existing import cycle through `statCodeTargets` → `worldTools`.
