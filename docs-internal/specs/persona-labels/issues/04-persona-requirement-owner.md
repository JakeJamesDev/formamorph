# 04: Persona as Requirement Owner

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The requirement owner that means the played entity changes by side. In the editor it reads **Persona**. In play it reads the persona's name plus the You pill. Rulings Q5, Q7, Q11, Q13 (glossary), Q18, Q19. Opus, because the requirement text builder has to serve two sides without changing stored data.

## What to build

An author adds a Condition on a trait and picks its owner. The list reads **Persona**, then the entities, and the row reads "Persona: Elf". **Playing As** keeps its name.

A player whose trait carries the same requirement sees "Kate [You]: Elf": the persona's name with the pill. The stored owner kind `you` stays. The requirement text builder learns which side it serves.

The editor-side wiki follows:

- World Editor Traits names the owner **Persona**. This covers the owner step, the **Whose Trait Counts** text and its table row.
- The Glossary's **Owner** row and CONTEXT.md name the owner **Persona**.
- In-game pages keep "marked **You**".
- The help search index is rebuilt in the same commit.

## Acceptance criteria

- [ ] The requirement owner picker offers **Persona** first. The editor's requirement text reads "Persona: <target>".
- [ ] In play, the same requirement's owner reads the played persona's name plus the shared pill. With no persona, it keeps the editor word.
- [ ] Stored data still uses the owner kind `you`. No world or save shape changes.
- [ ] **Playing As** and its **Persona** breadcrumb are unchanged.
- [ ] Trait-gate and requirement field tests assert **Persona** in the editor and the name plus the pill in play. Putting back **You** makes them fail.
- [ ] World Editor Traits, the Glossary **Owner** row and CONTEXT.md say **Persona**. In-game pages still say "marked **You**".
- [ ] `build:help-vectors` ran, and its output is in the commit.
- [ ] A changelog fragment. Four gates green, exit codes read.
