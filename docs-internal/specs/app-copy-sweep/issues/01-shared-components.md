# 01: Shared Components

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: shared strings appear on many screens, so each rewrite needs every caller's context.

## What to build

Sweep the copy of the shared components every screen uses under the Writing Guide. Every copy role is in scope (Q1). Rewrite the copy yourself; never delegate it to a subagent.

**Files.** A file in these folders that is not listed belongs here too. A file that could belong to two tickets goes to the spec session.

- `src/components/` root files, except `AiSetupGate.tsx` (02) and `PatreonSection.tsx` (07)
- `src/components/ui/`
- `src/lib/UtilityComponents.tsx`, `src/lib/messageSeverity.ts`

**Notes**

- This ticket owns shared strings (Q12). Other tickets send shared-string problems to the spec session, which forwards them here while this ticket runs.
- A shared string reads correctly on every screen that renders it. Check each caller before you rewrite.

Spec: Rulings, "Per ticket", "Facts and bugs", Testing Decisions.

## Acceptance criteria

- [x] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words. AST string inventory of all 137 files, each fact checked against the code (export path in `entityFile.ts`, bold offset in `fontTuning.ts`, preview position in the reveal dialog); a separate spec review rechecked the facts.
- [x] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason. See "Sweep counts" under Landed.
- [x] Raw help paragraphs in the listed files render through Hint or Meta. raw-hint-role 28 → 1, and the one left is specimen text (R6).
- [x] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests. Two renames, both in the reveal dialog. No Find caption, doc or test names the old labels.
- [x] Comments in the listed files changed only when false, history-telling, or figurative (Q6). About 45 image verbs and one history note were fixed. Em-dash-only comments were left.
- [x] Every test that pinned a changed string is updated. Grepped tests for each old string; prepare's affected-tests gate is green.
- [x] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed. There were no in-place bug fixes.
- [x] No changelog fragment.

## Landed

**Not verified**

- None. The screens were not opened in the preview; that check is the For-you line below.

**For you**

- For you: Open a few screens that use the swept shared components (Settings rows, a confirm dialog, the error details dialog) and read the help text.
- Narration reveal dialog (Settings → Display): the effect captions and the Reduce Motion note were rewritten, and the box is now titled **Speed limit**.
- Generate image dialog and the linked-image badges on an image slot: new tooltips.

**Drive-bys** (veto any of these)

- `ConfirmDialog`: `description` is now required, and its "This action cannot be undone." fallback is gone (R9). No caller relied on it.
- Reveal dialog labels: "Easing (all effects)" → "Easing for all effects" (Q5, parenthetical). The help box heading "Minimum speed." → "Speed limit.", because the settings cap the reveal speed (Q5, name differs from its help).
- Reduce Motion note: it named **Move**, but the control is **Move in**.
- `EditorRowList` doc comment: a history note was rewritten as current behavior.

**Sweep counts** (`copy:sweep` over the ticket's files; label-case is case-only, so Q5 nits)

| Rule | Before | After | Triage of what remains |
|---|---|---|---|
| label-case | 52 | 52 | Case-only (Q5 nit) |
| raw-hint-role | 28 | 1 | Specimen paragraph in ThemePreviewDialog (R6) |
| period-shape | 19 | 10 | 8 are specimen text (R6). 2 are status lines with a subject, which keep their period: "The image appears here." and the VRM credit note |
| raw-font-size | 8 | 6 | Badge and avatar initials below the smallest role, the dev readout, specimen, and a relative `0.9em` for code in a popover. Changing these is a layout change, out of scope |
| ellipsis | 5 | 1 | Specimen "Select…" (R6) |
| label-parenthetical | 4 | 4 | ViewportReadout property names (R7). The other three are template-literal parentheses the script misreads |
| figurative | 2 | 1 | `muted` is a CSS class token |
| term-picture | 2 | 0 | — |
| uncontracted | 1 | 0 | — |
| em-dash | 1 | 0 | — |
| many-sentences | 1 | 1 | The unreadable-host tip is two sentences. The script also counts the dots in the `value ?? ''` URL line |
| **Total** | **123** | **76** | |

**Findings** (for other tickets, not edited here)

- `src/lib/placeholderInsert.ts:7` builds "Add keyword — { inserts a placeholder" with an em-dash aside. That file is outside 01.
- `src/components/design-system/MainMenuContextMenuReference.tsx:140` (ticket 11): "Delete Character" with "Are you sure you want to delete this character? This action cannot be undone." uses the wrong term and a generic consequence.
- `TagsField` and `FontTuneDialog` both render their Hint after the control, which breaks Field help order. Moving them is a layout change, out of scope here.

**Shared strings sent to the spec session:** none.
