# 08: Persona rename on shared names, and dictionary name-drift

Status: done
Base: 2242003f
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Parent: [Stat Code Entities spec](../spec.md)

## What to build

Two follow-ups from ticket 04's review. A rename leaves a `persona` path alone while another playable entity still owns the old name (Q27). Name-drift warns when two dictionaries share a code name, as it does for entities (Q7, Q13).

## Acceptance criteria

- [ ] Renaming a placeholder one playable entity owns rewrites `persona.placeholders.Old` only when no other playable entity owns `Old`. Otherwise the path stays unchanged.
- [ ] The same rule applies to `persona.traits['Old']`.
- [ ] A rename with no other owner still rewrites the path.
- [ ] Name-drift warns on two dictionaries that share a code name.
- [ ] Tests at the rename and name-drift seams, each shown to bite. The changelog line is in In Progress.
