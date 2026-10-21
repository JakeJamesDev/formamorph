# 05: Persona as Relationship Target

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

The relationship target that means the played entity reads **Persona**. Ruling Q10. Sonnet at low effort, because it's one label in one field plus its tests.

## What to build

An author opens an entity's **Profile** tab and adds a relationship:

- **Add a relationship** lists **Persona** first, then the entities.
- The **Persona** row's role input is named **Persona's Role**.
- The AI line doesn't change. It still uses the picked persona's name ("Ash is Rowan's son").
- The stored target id `you` stays.

The relationships entry under 🚧 In Progress says **Persona** in place of **You**. This target never shipped, so no other changelog line is needed.

## Acceptance criteria

- [ ] The target reads **Persona** in the list and on its row. Its role input's accessible name is **Persona's Role**.
- [ ] An entity that plays only when picked still gets no **Persona** target.
- [ ] A stored `you` row still loads and shows as **Persona**. No world shape changes.
- [ ] The relationship field tests assert **Persona** and **Persona's Role**. Putting back **You** makes them fail.
- [ ] The relationships wiki text that names the target says **Persona**.
- [ ] The In Progress relationships entry says **Persona**, through a changelog fragment. Four gates green, exit codes read.
