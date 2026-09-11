# Stat Code v3: Surface Parity

Status: ready-for-agent
Status note: Tickets 01–06 cut 2026-09-11 under `issues/`. Frontier at start: 01, 04, 06.

## Problem Statement

Stat code v2 gave a script three things to read beside the stats: what the turn did before it ran, the world's placeholders, and the player's traits. The shapes do not match each other. `self.previous` is a two-field fragment, so an author cannot ask what the stat's min or name was at the start of the turn, and the editor cannot complete it like a stat. The turn inputs are named `requested` and `regenApplied`, which say nothing about who moved the stat. Placeholders are pinned by assigning `value`, while releasing a pin is a method call. And `stats` is a list to search, while `placeholders` and `traits` are maps to index, so an author learns two ways to reach a named thing.

## Solution

One shape for every entry, and one word for every change. A stat's `previous` is the whole stat as it stood at the start of the turn, read-only, so it completes and reads exactly like the stat itself. Every change the turn made lives under `delta`, keyed by who made it. A placeholder is pinned with `pin(text)`, the mirror of `unpin()`. The name-keyed maps read alike, and the editor completes, checks, and documents each of them the same way.

## User Stories

1. As a world author, I want `self.previous` to carry every field a stat carries, so that I can read the min, max, regen, or name the stat had when the turn started.
2. As a world author, I want `self.previous` to be read-only, so that a mistaken write to it changes nothing and the editor tells me.
3. As a world author, I want completions after `previous.` to list the stat's fields, so that I do not have to remember which ones exist.
4. As a world author, I want every stat in `stats` to carry the same `previous` and `delta` as `self`, so that I can compare another stat's movement with mine.
5. As a world author, I want one `delta` entry that holds every change this turn made to the stat, so that I find them in one place.
6. As a world author, I want `delta.ai` to hold the change the AI asked for, raw, so that I can clamp, scale, or refuse it.
7. As a world author, I want `delta.regen` to hold the change regen made this turn, so that I can separate it from the AI's change.
8. As a world author, I want `delta.total` to hold everything the turn asked of the stat, added up, so that I see the whole ask in one number.
8b. As a world author, I want `delta.actual` to hold what landed since the start of the turn, so that I do not have to subtract `previous` myself and I can compare it with `total` to see what the range took.
8a. As a world author, I want every `delta` source to carry the same numeric fields a stat carries, so that `delta.ai.max` and `delta.actual.regen` both exist and I never guess which source has which field.
9. As a world author, I want `delta` to be read-only, so that writing into it cannot masquerade as a change.
10. As a world author, I want `placeholders.<name>.pin(text)` to pin a placeholder, so that pinning and unpinning read as a pair.
11. As a world author, I want `pin(text)` to be what the help, the guide, the completions, and the templates show, so that I learn one way first.
12. As a world author, I want assigning `placeholders.<name>.value` to keep working, so that code I already wrote still runs.
13. As a world author, I want `pin()` of a non-text value to fail the run the way a non-text `value` write does, so that a mistake is loud.
14. As a world author, I want a write to `pin` on a name the world has no placeholder for to be dropped and reported, so that a rename does not break my world silently.
15. As a world author, I want the editor to underline a `pin()` call on an unknown placeholder name, so that I see it before the run.
16. As a world author, I want Test Code to list a pin made with `pin()` the same as one made with `value`, so that the report does not depend on which I chose.
17. As a world author, I want the templates that pin a placeholder to use `pin()`, so that inserted code shows the suggested form.
18. As a world author, I want `stats` to be a map keyed by stat name, so that `stats.Health.value` reads like `traits.Brave.enabled` and `placeholders.Mood.value`.
19. As a world author, I want a stat name with a space or odd characters to work through bracket syntax, so that no name is off limits.
20. As a world author, I want my existing `stats.find(s => s.name === 'X')` lookups rewritten to the map form when my world loads, so that the code I already wrote keeps running.
21. As a world author, I want the guide, the help, and the templates to show only the map form, so that there is one way to reach a stat.
22. As a world author, I want the editor to complete stat names after `stats.` and inside `stats[…]`, so that I do not misspell one.
23. As a world author, I want the editor to warn when two stats share a name, so that I know which one the map reaches.
24. As a world author, I want a write to another stat's entry through the map to get the "write to self instead" warning, so that the rule is one rule.
24a. As a world author, I want an unknown stat name to read as a blank entry and be underlined in the editor, so that a rename is loud in the editor and quiet at run time.
24b. As a world author, I want a way to iterate every stat, so that an average-of-all-stats formula is still one line.
25. As a player, I want a saved game from v2 to load and run its stat code unchanged, so that a rename inside the sandbox never costs me a playthrough.
26. As a maintainer, I want the surface list to stay the one description of the sandbox, so that completions, diagnostics, and help cannot drift apart.

## Implementation Decisions

**1. `previous` is the whole stat, frozen (locked).**

- The host marshals each stat's pre-turn entry with the same fields as a live entry: `id`, `name`, `type`, `description`, `min`, `max`, `value`, `regen`. It carries no `previous` and no `delta` of its own; one level deep.
- `min` and `max` are the effective bounds at the start of the turn, traits and code bounds included. `regen` likewise.
- The object is frozen inside the sandbox. A write does nothing. The editor flags a write to any `previous` field as it flags a write to a read-only `self` field.
- Where the turn has no pre-turn entry for a stat (the first turn, a clock-only run, Test Code), `previous` is a copy of the current entry.
- The per-turn seam takes the full pre-turn stats, as GameViewer already hands them, instead of a value-and-max fragment.

**2. Every change lives under `delta` (locked).**

- `delta` is a read-only object on every stat entry, `self` included. The names `requested` and `regenApplied` are removed. They shipped in the In Progress bucket only; no bundled or migrated world uses them.
- Every `delta` source is one shape: the stat's numeric fields, `{ value, min, max, regen }`. A source that cannot move a field reports zero for it. The shape never depends on the source, so a field an author reads on one source exists on every other.
- `delta.ai`: the change the AI asked for this turn, raw, before flags and clamping. Today the AI asks for `value` and `max` only, so `min` and `regen` read zero. If the stat request ever grows a min or regen ask, it lands in the existing field with no shape change.
- `delta.regen`: what regen did this turn, after the enabled gate and clamping. Regen moves `value` only, so the other three read zero.
- `delta.total`: every source added up, field by field, raw. `ai + regen` today; a later source adds to it. It is what was asked of the stat, before flags and the range.
- `delta.actual`: the current numbers minus `previous`, field by field. It is what landed, after flags and the range. A code write this run is not in it, since code reads its own snapshot. `max` here shows an AI max change that landed; `min` and `regen` show a bound a trait or an earlier code run moved since the turn started.
- `total - actual` is what flags and the range took. It gets no name of its own; the guide shows the subtraction once, under refunding what a cap ate. A `noIncrease` flag that zeroed an ask still shows the ask in `total` and the loss in that difference: the flag is a clamp, not a smaller ask.
- The nesting is the point. One completion after `self.` names every change source, a later source lands beside the others and inside `total`, and every source completes to the same four fields. A candidate the design leaves room for, not built here: `delta.trait` for the bound movement a trait switch made.
- The surface list gains `delta` with four members and drops the two old names. Completions after `delta.` list `ai`, `regen`, `total`, `actual`; after any of those, the four numeric fields.

**3. `pin(text)` is the suggested way to pin (locked).**

- The placeholder prelude adds `pin(text)` as an alias of the `value` setter. The reader sees one write either way; the last of `pin`, `value`, and `unpin` wins.
- A non-text argument fails the run as a `bad-write`, with the same message shape as the `value` write. A `pin()` on an unknown name is dropped and reported, since an unknown name reads as a blank entry.
- The editor's static checks treat `.pin(` as a write to that placeholder for the unknown-name and duplicate-name diagnostics, as they treat `.unpin(`.
- The completion for `value` describes a read; the completion for `pin` describes the write. `value` stays assignable and stays in the surface list, but no hint, guide sample, or template nudges toward it.
- The Placeholder Follows This Stat template and the guide's pin samples use `pin()`.

**4. `stats` is a name-keyed map, and old lookups are migrated (locked).**

- `stats` is built on the same tracked-map prelude as `placeholders` and `traits`: keyed by stat name on a null prototype, an unknown name reads as a blank entry, a name with a space is reached with brackets, and of two stats sharing a name the last authored is the entry. The array is gone.
- `self` is the map's own entry for the current stat, the same object, so `self` and `stats[self.name]` are one.
- A blank entry for an unknown stat carries the entry shape with `id` and `name` empty and every number zero, `max` included, so a formula over a missing stat reads a quiet zero rather than throwing. The editor underlines the name.
- Only `self` takes writes. A write to another entry through the map gets the existing "write to self instead" warning in the editor and is ignored by the host, as today.
- `currentStatId` stays as a global for one more release, undocumented. Code that compared against it is rewritten by the migration to `self`.
- Iteration is `Object.values(stats)`; the help and the guide show it once, for the average-of-all formula.
- **Migration.** A world migration rewrites, inside every stat's `code`, the two lookup spellings the templates and the guide ever taught: a `find` on `name` against a string literal becomes a bracket index with that literal, and a `find` on `id` against `currentStatId` becomes `self`. Whitespace, the arrow parameter's name, `===` versus `==`, and an optional-chain or field tail are all matched; anything else is left alone. A declaration named `self` whose initializer the rewrite turned into bare `self` is deleted whole, `const`, `let`, or `var`, because the sandbox already declares `self` and the line would otherwise read `self` before its own initialization. A declaration of any other name keeps the alias: `const me = self;`. The migration is idempotent and lives with the other world migrations. It runs at the import boundary and at world load, gated on a world version the user sets at release. Bundled worlds are edited by hand and ship already in the map form. Code the migration cannot rewrite fails at run time with the Test Bench's execution row naming the stat, which is the existing path for broken code.
- The stat slot in templates already expands to a quoted name, so `stats[{{source:stat}}]` is the template form.
- The editor's stat-like scanner keys off `stats` and `self` as before; what changes is the shape it expects after `stats`: a dot or bracket names an entry, and the entry completes to the stat fields. Completions after `stats.` list stat names; inside `stats[` they list quoted names.

## Testing Decisions

A good test drives the sandbox as a turn does and reads what came out: the returned stats, the pins, the switches, the diagnostics. It never inspects the prelude text or the row format.

- **Primary seam: the per-turn run.** Given full pre-turn stats, asks, regen, and the maps, assert `previous` carries every field, `delta.ai`, `delta.regen`, `delta.total`, and `delta.actual` hold the expected numbers, with `actual` short of `total` on a capped ask, a write to `previous` or `delta` changes nothing, and `pin(text)` lands as a Code Pin. Prior art: the existing per-turn tests beside the turn module.
- **Executor seam** for what only the sandbox shows: `previous` is frozen, `pin()` of a non-text fails as `bad-write`, `pin()` on an unknown name is reported, the last of `pin`/`value`/`unpin` wins, `stats` has no `find`, an unknown stat name reads as a blank entry, and `self` is identical to its map entry. Prior art: the executor's placeholder-write tests.
- **Migration seam.** The world migration is a pure function over a world: given code in each taught spelling, whitespace and parameter-name variants, the `id` form with a `self` declaration and with another name, and code it must not touch, assert the rewritten code and idempotence. Prior art: the version module's migration tests.
- **Editor seam.** Diagnostics: a write to a `previous` field, a `pin()` on an unknown or duplicate name, a write to another stat through the map. Completions: after `previous.`, `delta.`, `delta.ai.`, and after the stat map's dot and inside its brackets. Prior art: the analysis tests.
- **Surface drift guard.** The surface list describes every injected name and no other; the existing drift test beside the surface module extends to `delta` and the four-field delta shape.
- **Templates.** Every built-in template runs in the sandbox under the new surface; the pin template reports its pin. Prior art: the template sandbox tests.
- **Live check.** The e2e stat-code spec gains one case reading `delta.ai` and `previous.min` through a real turn.

## Out of Scope

- `delta.trait`. Named so the nesting has somewhere to grow; not built. What the range took has no name; it is `total - actual`.
- Removing the `currentStatId` global. It stays one release, undocumented, so unmigrated code has a chance.
- Any change to the save envelope or the world file shape. The migration rewrites the text of `code`; it adds no field. `codeBounds` and `codePins` are as v2 left them.
- Rewriting stat code beyond the two taught lookup spellings.

## Further Notes

- `requested` and `regenApplied` were never released, so their removal is a rename inside an unreleased feature, not a migration. The changelog entry for v2 is edited in place rather than given a "removed" line.
- The tracked-map prelude from the v2 review fix is the one mechanism for every name-keyed map. The stat map is its third use, not a new one.
- Replacing the array is a deliberate break for community worlds with hand-written stat code. Stat code is rare in the catalog today; the migration covers every spelling the app itself ever taught, and the Test Bench names what it could not rewrite. This is the moment to take the break, before the surface is widely used.
- The world version that gates the migration is the user's release call.
