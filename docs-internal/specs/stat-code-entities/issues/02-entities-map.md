# 02: Entities map

Status: done
Base: 8fa13c68
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Parent: [Stat Code Entities spec](../spec.md)

## What to build

Stat code gets an `entities` global. Each entry has `name` and `traits`, in the shape `persona` has. Stat code can read and switch any listed entity's traits, and `persona` becomes the played persona's `entities` entry (Q5–Q8).

## Notes from ticket 01

- Authored entity names reach stat code through `codeEntities` on `useResolvedWorld`. GameViewer may not read the raw entity list (a persona-readers test forbids it), and Bearers carry rolled names. Build on that field.
- `StatCodeResult` has flat persona fields: `personaTraits`, `unknownPersonaTraits` and `personaAcquiredWrites`. The per-entity result replaces them; it does not sit beside them.

## Acceptance criteria

- [x] `entities` lists authored entities, library characters added at Enter World, and the played persona. Characters the narrator invents are not listed (Q5).
- [x] An entity trait write switches that entity's owned trait and cascades as a manual switch does (Q6).
- [x] `persona === entities[persona.name]`, so a write through either is one write (Q8).
- [x] Entity names reach code under their code name. Of two entities sharing a code name, the later one wins (Q7).
- [x] An unknown or not-in-play entity reads as a blank entry (Q23, Q25). A write to its trait is warned about and dropped.
- [x] Completions and diagnostics offer entity names and their trait names. An entity rename rewrites `entities['Old']`, and a trait rename rewrites `entities['X'].traits['Old']` and `persona.traits['Old']`. Name-drift warns on a shared entity code name.
- [x] The editor test run lists authored entities with nothing chosen.
- [x] Tests at `runStatCodeTurn` and the rename and name-drift seams, each shown to bite. The changelog line is in In Progress.

## Notes for review

- Bite run: nine mutations, each failing its tests. Dropping the persona name override, the in-play filter, entity writes in the turn, the persona traits, later-wins keying, the entity name check, the entity trait rename, the entity key rename, and the editor run's entities.
- An authored entity whose code name is empty shares the empty persona's key, so a switch through it reports as an unknown trait. Not handled.
- Out of this ticket: the Test Bench run sends no entities, and renaming an entity's own trait checks for name clashes against the world's traits.
