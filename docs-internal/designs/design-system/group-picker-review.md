# Short Tile Menus and Group Picker: Review

## Scope and sources

The approved composition is `prototype/tile-group-picker` at `47ed367b`. The production implementation uses the existing library operations, stable Group IDs, shared dialog/scrollbar, and a new compact choice row. The showcase runs those components and operations against local fixtures.

- [Issue and acceptance criteria](../../specs/design-system-additions/issues/01-short-tile-menu-and-group-picker.md)
- [Design patterns](../../../docs/Design-System.md#pattern-compact-selection-lists)
- [Writing Guide](../../../docs/Writing-Guide.md)
- Direct picker: `#dev?modal=designSystem&tab=context-menu&subtab=picker`; naming form: `subtab=create`.

## Behavior and layout evidence

Browser checks used the production showcase at 1280×800 and 390×844, then 390×320, 390×260, and 390×220.

| Check | Observed result |
| --- | --- |
| Shortcuts | Three text-only destinations, full accessible names, no native title, followed by the two icon actions. Ordinary menu viewport height equals its scroll height. |
| Focus | Shift+F10 opens the menu. Picker search receives focus after teardown. Escape and Cancel return focus. The real-grid integration test verifies fallback focus after a move unmounts the tile. |
| Scrolling | On mobile, the destination viewport scrolled to 157px while the outer viewport stayed at zero. Search/footer stayed outside the list. |
| Short height | At 390×220, outer viewport height was 202px and content height 286px; Create remained reachable and successfully assigned the sample. At 390×260, the menu remained within the viewport and End revealed/focused Delete. |
| Appearance | Dark and light; Purple with OpenDyslexic. Short rows measured 32px with 6px/8px padding; a wrapped OpenDyslexic name measured 52px. |
| Enlarged text | Font customization at 150% produced `font-size-adjust: 0.78`; the short-height form exposed duplicate validation and accepted a corrected name. |
| Mobile footer | Affirmative action above Cancel when stacked; Cancel to the left on desktop. |
| Selection/validation | Search, no results, selected check, no-op choice, duplicate rejection, corrected creation, and cancellation exercised through production code. |

Local screenshots are in [the evidence folder](../../../.scratch/group-picker-evidence): `desktop-light-purple-opendyslexic.png`, `desktop-dark.png`, `mobile-light-selected.png`, `mobile-dark.png`, `mobile-dark-menu.png`, `short-menu-keyboard.png`, and `enlarged-short-create.png`.

**Remaining device checks:** native browser zoom was not established: Ctrl+Plus in the in-app browser left viewport dimensions and device-pixel ratio unchanged. Reduced viewport and enlarged font checks are separate evidence, not a claim of native zoom coverage. Physical touch-device verification remains manual; the preserved shared touch-hold/drag/dismissal tests passed.

## Tests and review

- Full suite: **8,626 passed, 3 skipped, exit 0; 63.46 seconds**. Its aggregate test time was 378.19 seconds across concurrent workers, with no post-suite handle delay observed.
- Initial full run: 8,623 passed and three child-process launch failures in 60.68 seconds. Adding the bundled Node directory to PATH resolved these environment failures without changing tests.
- Targeted runs: 9 passed in 3.12 seconds; fixture-pruning failures in 3.16 seconds; corrected 12-case flow in 3.40 seconds; 71-case coverage run in 7.42 seconds; real-grid/dev-route checks, 21 passed in 4.06 seconds.
- Mutation checks all failed the intended assertion and restored the original source: shortcut limit (2.34s), current-group eligibility (2.13s), search filter (2.17s), current assignment (2.20s), duplicate UI guard (2.17s), blank UI guard (2.34s), operation validation (1.77s), named creation forwarding (3.02s).
- Typecheck and lint: exit 0. Build: exit 0, 14.51 seconds; existing large-chunk warning remains. AST graph update completed.
- Final focused coverage run after the viewport fix: **118 passed, exit 0, 11.24 seconds**. Menu, picker, compact row, and showcase: **100% lines**; all selected modules: **98.79% lines / 95.70% branches**. The hook measured 93.33% lines and organization operations 98.52%; uncovered lines are existing unrelated drag, prompt-preset, and boundary paths.
- Spec review: no confirmed findings. Standards review: no violations; one low-priority duplication suggestion for UI/operation name validation. Both checks remain intentionally present: immediate field feedback and authoritative mutation protection.

No version, export schema, or default changed. New named creation only uses the existing Group name field.

## Functional copy review

Reviewed against the [official ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf) and the repository role conventions. This is a bounded review, not full certification.

| Role | New or changed copy | Review |
| --- | --- | --- |
| Labels | Create New Group…, Add To Group…, Find a Group, Group Name, Create Group, Groups | Local casing and established product terminology retained. Label-fragment grammar remains unverified under the Writing Guide. |
| Duplicate error | A group has this name. | Complete descriptive sentence; reports the actual trimmed, case-insensitive conflict. HAVE meaning review remains unverified. |
| Blank recovery | Write a group name. | One imperative action. WRITE: dictionary 2-1-W7, PDF page 431; NAME: 2-1-N1, PDF page 315. |
| Empty status | There are no groups. | Complete existence statement, distinct from search failure. |
| Search status | The search found no groups. | Complete past-tense result statement. FIND/FOUND: 2-1-F6, PDF page 250. |
| Authored values | World and Group names | Preserved verbatim; no rewriting, shortening, or name-based identity. |

`group` is a technical noun for a device-local collection of library item IDs; `search` names this chooser's filter operation. Proposed admission uses rule 1.5, category 19, tied to the production domain and picker. It is not an external endorsement. No new technical verb is necessary; “Write” avoids admitting “enter” in a new sense.

Sections 1–4 and 8–9 apply to terminology, complete sentences, simple active verbs, punctuation, and consistency; section 5 applies to the recovery instruction, and section 6 to status/error descriptions. No safety procedure or extended help was introduced, so section 7 has no applicable content. Remaining vocabulary/label-grammar limits and the inherited showcase copy limits prevent a full-STE verdict.
