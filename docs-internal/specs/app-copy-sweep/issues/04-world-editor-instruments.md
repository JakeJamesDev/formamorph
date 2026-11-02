# 04: World Editor Instruments

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: instrument and Test Bench copy mixes author help with technical findings.

## What to build

Sweep the copy of the World Editor instruments, Test Bench and the authoring tour under the Writing Guide. Every copy role is in scope (Q1). Rewrite the copy yourself; never delegate it to a subagent.

**Files.** A file in these folders that is not listed belongs here too. A file that could belong to two tickets goes to the spec session.

- `src/components/editor/`
- `src/components/aiContext/`, `src/components/authoringTour/`, `src/lib/authoringTour/`, `src/lib/testBench/`
- `src/views/WorldEditor.tsx`
- `src/lib/placeholderInsert.ts`: the "Add keyword" insert line has an em-dash aside (ticket 01 finding)

**Notes**

- Test Bench findings and editor warnings take the technical register.

Spec: Rulings, "Per ticket", "Facts and bugs", Testing Decisions.

## Acceptance criteria

- [x] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words. Hand pass over every string in the listed files, including about 110 Test Bench finding messages in `rules.ts`; Standards and Spec reviews folded in.
- [x] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason. Table below.
- [x] Raw help paragraphs in the listed files render through Hint or Meta. raw-hint-role 72 → 0.
- [x] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests. Renames listed below. None names a world field, so the Find bar is not affected; every test that names one is updated.
- [x] Comments in the listed files changed only when false, history-telling, or figurative (Q6). Image verbs only ("lands", "in force", "stands in", "sits over"); no history notes found.
- [x] Every test that pinned a changed string is updated. Grep for each old string, then the touched suites and the gates' affected tests, all green.
- [x] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed. No bug fixes in place.
- [x] No changelog fragment. None in the diff.

## Landed

**Not verified**

- None. The screens were not opened in the preview. That check is the For-you line below.

**For you**

- For you: Open the Opening, Triggers, AI Context and Issues instruments and the Test Bench, and read the hints and findings.
- Triggers tab: entries now **activate** (R17), and the **Always On** badge reads **Always Inject**, the same as the entry's checkbox.

**Renames** (veto any of these)

- Lens selects' accessible names: "Test as character" → "Testing as", "Test at location" → "Testing at". The Opening badge "Lens Pick" → "Testing As" (R16).
- Triggers badge for a constant entry: "Always On" → "Always Inject" (Q5, name differs from its field).
- History list row's accessible name: "… (undone)" → "…, undone" (Q5, parenthetical). `HistoryControlsReference.test.tsx` (ticket 11's folder) is updated for it (R14).
- `placeholderHint`: "Add keyword — { inserts a placeholder" → "Add keyword, or type { to insert a placeholder". `PlaceholderManager.test.tsx` (03's folder) is updated for it.

**Drive-bys:** none beyond the renames. No in-place bug fixes.

**Sweep counts** (`copy:sweep` over the ticket's files)

| Rule | Before | After | Triage of what remains |
|---|---|---|---|
| raw-hint-role | 72 | 0 | — |
| label-case | 20 | 20 | Case-only (Q5 nit). Includes the R16 names "Testing as" and "Testing at", which copy the visible words |
| figurative | 6 | 1 | `muted` is a CSS class token |
| period-shape | 3 | 1 | `steps.ts:310` is tour sample world text (R18) |
| ellipsis | 3 | 1 | "Checking…" is a progress state |
| term-picture | 3 | 0 | — |
| label-parenthetical | 1 | 0 | — |
| raw-font-size | 1 | 1 | The pin count badge's `text-[10px]` is below the smallest text role. Changing it is a layout change |
| term-character | 1 | 0 | — |
| uncontracted | 1 | 1 | `steps.ts:310`, sample world text (R18) |
| **Total** | **111** | **25** | |

**Findings** (not edited here)

- `docs/Test-Bench.md` still says "fire" for entries. R17 routes it to the docs-sweep wording tickets.
- Test Bench near-miss lines, script-check findings and toasts are status text with a subject, so they keep their periods. Two-sentence finding messages end with a period; one-sentence ones take none.
- `Meta` now renders two popover titles ("World Doctor", "History") and the lens bar's "Testing as" / "at" words, which match its style. Its doc comment says "Incidental data". If titles need their own role, that is a design-system question.
- The Find bar's replace-all summary at `EditorFindBar.tsx:334` is a multi-sentence status. It was left as one notice.

**Shared strings sent to the spec session:** none.
