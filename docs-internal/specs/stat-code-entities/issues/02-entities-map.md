# 02: Entities map

Status: in-progress
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

- [ ] `entities` lists authored entities, library characters added at Enter World, and the played persona. Characters the narrator invents are not listed (Q5).
- [ ] An entity trait write switches that entity's owned trait and cascades as a manual switch does (Q6).
- [ ] `persona === entities[persona.name]`, so a write through either is one write (Q8).
- [ ] Entity names reach code under their code name. Of two entities sharing a code name, the later one wins (Q7).
- [ ] An unknown or not-in-play entity reads as a blank entry (Q23, Q25). A write to its trait is warned about and dropped.
- [ ] Completions and diagnostics offer entity names and their trait names. An entity rename rewrites `entities['Old']`, and a trait rename rewrites `entities['X'].traits['Old']` and `persona.traits['Old']`. Name-drift warns on a shared entity code name.
- [ ] The editor test run lists authored entities with nothing chosen.
- [ ] Tests at `runStatCodeTurn` and the rename and name-drift seams, each shown to bite. The changelog line is in In Progress.
