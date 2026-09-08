# Code Templates reference review

Ticket [08](../../specs/design-system/issues/08-code-templates-reference.md) adds the production stat Code Templates dialog to the development showcase. The reference supplies neutral stats, an in-memory personal-template library, controlled import/export text, and a local insertion target.

## Production and isolation boundary

`StatCodeTemplateDialog` still uses `StatTemplateStorageService` and browser file actions by default. The showcase supplies the new public repository and file-transfer boundaries, so all reads, saves, duplication, deletion, import, and export remain in the mounted reference. Slot parsing, defaults, validation, generated code, ownership actions, and confirmation behavior stay in the production dialog.

Automated interaction covers required stat inputs, invalid and valid numbers, generated-code updates, disabled and enabled insertion, local insertion, import, export, deletion, and duplication. The adapter guard fails if the dialog reads the production repository, and the insertion guard fails if generated code does not reach the local sample target.

## Functional-copy inventory

Reviewed source scope: new functional text in `CodeTemplatesReference.tsx` and the new Code Template registry entry in `DesignSystemShowcase.tsx`. Existing strings in `StatCodeTemplateDialog.tsx` are inventoried as reused production copy; this ticket does not certify or bulk-rewrite them. Sample stat names, descriptions, template names, template explanations, and code are authored demonstration content.

| Source / exact text or family | Role | Review and behavior evidence |
| --- | --- | --- |
| `Code Templates`, `Stat Code Templates`, `Local Sample Target`, `Focus` | Navigation and headings | Title Case follows the local convention. Standalone label grammar remains unverified. `Focus` names the sample stat and is authored content. |
| `Selection, parameters, validation, and generated code` | Registry description | Identifies the four parts visible in the reference. It is a compact navigation fragment, not a complete descriptive sentence. |
| `Use the production dialog with controlled stats and local template data.` | Instruction | Imperative USE identifies the action and the controlled data boundary. `production dialog`, `stat`, `template`, and `data` need the technical-term review below. |
| `This stat receives generated code only in this mounted reference.` | Explanation | Complete sentence with one scope claim. Local insertion tests and live DOM evidence verify the claim. |
| `No code is inserted.` | Status | Complete descriptive sentence for the empty target. It changes only after the insertion callback runs. |
| `Open Code Templates` | Action label | Names the visible action. Title Case follows the local convention; label-fragment grammar remains unverified. |
| `Select “Open Code Templates”.` | Instruction | Imperative SELECT and quoted visible label follow the Writing Guide's existing-label pattern. |
| `The local sample stat code is updated.` | Completion status | Reports only the completed insertion callback. It does not claim that an authored world changed. |
| `The local template library saved “{name}”.` | Dynamic completion status | Reports a completed in-memory save and preserves the authored template name as quoted text. Technical SAVE is used in the application-data sense. |
| `The local template library erased the selected template.` | Completion status | Past active ERASE reports the completed local deletion. It avoids claiming that personal data changed. |
| `The local template library imported {count} template(s).` | Dynamic completion status | Reports the completed in-memory import with singular/plural output. IMPORT as an application operation needs the technical-verb review below. |
| `The local template export is ready.` | Completion status | Reports creation of controlled export text. No download or file write occurs. EXPORT as a technical noun needs the term review below. |
| Existing dialog labels, explanations, validation, confirmations, toasts, and action names | Reused production copy | Behavior remains covered by production tests and the integrated reference. Reuse does not establish full ASD-STE100 compliance. |

## Rule and terminology review

Source: official [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf), checked September 8, 2026. The [Writing Guide](../../../docs/Writing-Guide.md) supplies the complete review procedure and source-page map.

- Sections 1–4 apply to vocabulary, technical terms, noun clusters, verbs, and sentence construction. `stat` is an established Formamorph entity. Code Template, parameter, generated code, template library, import, and export are candidate category-19 application concepts; full dictionary-alternative comparison and admission remain unverified.
- Technical SAVE uses the application-data sense. IMPORT used as a verb requires a rule 1.12 decision; this review does not infer verb approval from a technical noun.
- Section 5 applies to the two instructions. `Select “Open Code Templates”.` uses the visible label as quoted text. Section 6 applies to explanations and status messages.
- Section 7 is not applicable because this reference contains no safety procedure. Sections 8–9 apply to punctuation, quoted dynamic names, terminology consistency, and writing practice.
- Accessible field names remain stable while `Required` and `Must be a number` are connected as descriptions. The dialog sets `aria-invalid`, and insertion stays disabled until validation succeeds.

**Verdict: reviewed with unresolved limits; not full STE compliance.** The new functional string families are accounted for by role and behavior. Standalone label grammar, the registry fragment, technical terms, and the IMPORT verb need qualified review before a full-compliance claim. Existing production dialog copy remains outside this ticket's rewrite scope.

## Verification evidence

The production dialog and local reference passed 16 focused tests in 5.39 seconds. A narrow coverage run passed nine tests in 6.81 seconds: the two touched components reached 94.69% statement/line, 77.35% branch, and 84.21% function coverage; the reference alone reached 99.18% statement/line coverage. Mutation checks proved that the adapter-list, local-insertion, and validation-description guards each fail when their boundary is broken.

The real browser spec passed all six desktop/mobile checks in 23.63 seconds. Its first run caught a stale-state race between quick consecutive slot selections; switching the production form to functional state updates made the same scenario pass without adding waits or weakening validation. Four isolated static runs passed in 11.65 seconds at 1280×860 and 375×812 in light and dark appearances. DOM evidence showed focus inside the dialog, no horizontal overflow, the desktop box within its viewport, the mobile shell at 0–812 px, the representative Lexend family in computed styles, and a 790 px long detail pane scrolling inside a 570 px mobile viewport. Captures are in `.scratch/design-system-code-templates/`.

Final gates passed on the combined checkout: typecheck in 12.92 seconds, lint in 12.99 seconds, 8,590 tests with three skipped in 57.05 seconds, and production build in 15.56 seconds. Aggregate test execution was 363.55 seconds across workers, so the 57.05-second wall time did not show an idle-tail gap. The knowledge graph update completed after the code change; its only parser warnings were the three existing Gradle files.
