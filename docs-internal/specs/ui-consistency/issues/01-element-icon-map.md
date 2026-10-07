# 01: Element Icon Map

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Recommended model rationale: one small new module, then about 30 mechanical call-site swaps listed in the audit. The change is wide but shallow.

## What to build

Each world element type shows one icon on every surface (Q1–Q6, Q14). One shared map names the icon for each type, and every surface reads from it instead of importing lucide icons directly. The library and community kind icons (`KIND_ICONS`) and the World Editor tab icons draw from the same map. The Main Menu library tabs no longer keep a hand-written copy.

The canon:

| Type | Icon |
| --- | --- |
| Trait | `ToggleRight` |
| Entity | `User`. `Users` only on a tab or heading that lists many entities |
| Location | `MapPin` |
| Stat | `ChartColumn` |
| Dictionary | `BookOpen` |
| Placeholder | `Braces` |
| Blueprint | `LayoutTemplate`, chip mark included |
| Persona | `CircleUserRound` |
| Avatar | `PersonStanding` |
| Opening | `Play` |
| World | `Earth` |
| Group | `Folder` |

`audit.md` (section 1) lists the surfaces to change, by type. The main swaps:

- **Trait:** the game panel and entity editor tabs move off `Sparkles`.
- **Stat:** the stat editor's Details tab and the trait editor's Stats tab move to `ChartColumn`.
- **World:** the World Editor's Overview tab, the card fallbacks and Compatible Worlds move to `Earth`.
- **Blueprint:** the chip mark moves from `Link2` to `LayoutTemplate`. `Link2` keeps the linked-copy meaning.
- **Persona:** persona rows and fallbacks move to `CircleUserRound`.
- **Avatar:** the game's mobile Avatar tab moves to `PersonStanding`.

Stat Code Templates move from `LayoutTemplate` to `SquareFunction`, in the editor button and the Design System reference.

Sub-tabs that name a facet rather than an element type keep their own icons, such as **Details** with `Tag`, or **Profile**. Action icons also stay: `UserPlus` and `BookPlus` on import, `FolderPlus` on add.

Changelog fragment: a Fixed entry stating that each element type shows the same icon everywhere.

## Acceptance criteria

- [ ] One map holds the icon for every type in the table. `KIND_ICONS`, the World Editor tabs and the Main Menu tabs read from it.
- [ ] Every surface in the audit's icon table shows its type's canon icon.
- [ ] The Blueprint chip mark and Blueprint group rows show `LayoutTemplate`. Linked-copy marks still show `Link2`.
- [ ] Code Templates show `SquareFunction` in the stat code editor and the Design System reference.
- [ ] A guard keeps call sites on the map. Either a test fails when a call site goes back to importing a different icon directly, or a lint rule forbids direct imports of the mapped icons for element types. Prove the guard bites.
- [ ] The Design System guide names the map as the source of element icons. Changelog fragment written.
- [ ] Gates green.

## Blocked by

- None (can start immediately)
