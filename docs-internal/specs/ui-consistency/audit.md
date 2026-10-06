# UI Consistency Audit

Audited 2026-10-06. It covers spec items 1 (element icons) and 2 (hover and selected states). Test files are excluded.

## 1. Element icons

### Registries

No single registry maps element types to icons. Three partial ones exist:

| Registry | Covers | Readers |
| --- | --- | --- |
| `KIND_ICONS` ([catalogKinds.ts:54](../../../src/lib/catalogKinds.ts)) | world `Earth`, entity `User`, dictionary `BookOpen`, model `PersonStanding`, prompt `ScrollText` | Community browser, profile creations, `KindArt`. The Main Menu tabs copy it by hand ([MainMenu.tsx:181](../../../src/views/MainMenu.tsx)). |
| `WORLD_EDITOR_TABS` ([worldEditorTabs.ts:24](../../../src/views/worldEditorTabs.ts)) | Overview `Globe`, Stats `ChartColumn`, Entities `Users`, Locations `MapPin`, Traits `ToggleRight`, Dictionary `BookOpen`, Placeholders `Braces` | NavRail, Sections bar, their design-system references |
| `src/views/*PanelTabs.ts` | Each editor's sub-tabs | Panel tab strips |

Every other surface imports lucide icons directly.

### Icons in use per type

| Type | Icons in use (count) | Conflict |
| --- | --- | --- |
| Trait | `ToggleRight` 2 · `Sparkles` 2 · `Tag` 1 | ⚠️ Nav uses `ToggleRight`; the game panel and entity editor use `Sparkles`. |
| Entity | `User` 15 · `Users` 4 · `SquareUser` 1 · `UserPlus` 1 (import) | ⚠️ Nav and the game panel use plural `Users`; everything else uses `User`. |
| Location | `MapPin` 6 | ✅ |
| Stat | `ChartColumn` 3 · `Gauge` 1 · `Activity` 1 | ⚠️ The stat editor uses `Gauge`; the trait editor's Stats tab uses `Activity`. |
| Dictionary | `BookOpen` 9 · `BookPlus` 1 (import) | ✅ Entries have no icon. |
| Placeholder | `Braces` 3 · `Sparkles` 1 (built-in mark) | ✅ |
| Blueprint | `LayoutTemplate` 4 · `Link2` 1 (chip mark) | ⚠️ `Link2` also means "linked copy". |
| Persona | `User` 2 · `CircleUserRound` 1 · `UserCheck` 1 (action) | ⚠️ Shares `User` with Entity. |
| Avatar | `PersonStanding` 3 · `User` 1 | ⚠️ The game's mobile Avatar tab uses `User`. |
| Opening | `Play` 2 | ✅ |
| World | `Globe` 5 · `Earth` 2 | ⚠️ `KIND_ICONS` and the Main Menu use `Earth`; the World Editor and card fallbacks use `Globe`. |
| Group | `Folder` 5 · `FolderPlus` 2 (add) | ✅ Location groups have no icon. |

### One icon, two meanings

- `Sparkles`: Trait, built-in placeholder, AI generate.
- `LayoutTemplate`: Blueprint and stat Code Templates.
- `BookOpen`: Dictionary and Guide / Introduction / View Prompts.
- `Link2`: Blueprint chip and linked copy.
- `User`: Entity and Persona.

### Surfaces with no type icons

Search and replace results, AI Context, Formaquestion take-me-there, context menus, and the stat, location and dictionary-entry list rows.

## 2. Hover and selected states

**Token fact:** in the base blue theme, `--secondary`, `--muted` and `--accent` hold the same value in light and dark ([index.css:40](../../../src/index.css)). The default theme is graphite (`DEFAULT_THEME_COLOR`), where they differ by 1–2% lightness and `--primary` is near black (light) or near white (dark). So a hover and a selected state built from those grays, or from a light primary tint, read as the same.

### Main surfaces

| Surface | Hover | Selected | Same as hover? |
| --- | --- | --- | --- |
| NavRail ([NavRail.tsx:49](../../../src/components/NavRail.tsx)) | `bg-accent` | `bg-accent` + `font-medium` + primary bar | 🔴 Same fill. The Design System (L896–897) prescribes this. |
| Sections bar, Enter World categories | `bg-muted/50` | `bg-muted` + `font-semibold` | 🟡 Same hue, darker |
| EditorRow: every World Editor list and tree, Mascot tab ([EditorRow.tsx:115](../../../src/components/EditorRow.tsx)) | `bg-secondary` | `bg-primary` fill | ✅ |
| CompactSelectionRow: Settings Prompts, Formaquestion lists | `bg-secondary` | `bg-primary` + check | ✅ |
| Tabs primitive: Settings, Test Bench, game panels, profile, admin | none | `bg-background` + shadow in a muted track | ✅ (no hover) |
| Code Template library, Settings Tools list | `bg-muted` | `bg-accent` | 🔴 Same in the default theme |
| LocationCanvas search results | `bg-accent` | `bg-accent` | 🔴 Identical |
| Chat choice bubbles | `bg-primary` | `bg-primary` | 🔴 Identical, on purpose per a code comment |
| Test Bench Opening pool | `bg-muted/30` | `bg-muted/50` + primary border | 🟡 |
| Pages choice rows | `bg-primary/10` | `bg-primary` | 🟡 Same hue |
| Game setup and persona rows | `bg-muted/40` + border | `bg-primary/10` + primary border | ✅ |
| LocationModal tree | `bg-accent` | `bg-primary` | ✅ |

### Counts

- **16 hover styles.** The most common are `bg-secondary` (EditorRow, CompactSelectionRow), `bg-accent` and `bg-muted` at several alphas.
- **9 selected styles for list and nav selection:**
  - primary fill
  - accent fill
  - accent + bar
  - muted + semibold
  - background + shadow
  - primary/10 + border
  - muted/50 + border
  - text-primary only
  - icon only
- **3 "active nav row" recipes:**
  - NavRail: accent + bar + medium
  - Sections bar: muted + semibold
  - EditorRow: primary fill
- **2 font weights:** NavRail uses medium; the Sections bar uses semibold.

### What the Design System says

- **EditorRow:** primary fill (L594).
- **Compact lists:** primary fill and check (L474).
- **Sections bar:** muted and semibold (L839).
- **NavRail:** accent fill on both hover and selected; only the bar sets them apart (L896–897).
- **No hover rule** for EditorRow, compact lists, the Sections bar, tabs or tiles.
