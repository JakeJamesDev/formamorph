# Prompt Ribbon Selection

Status: ready-for-human

## Question

Which ribbon hierarchy makes the active prompt and subsection clear while fitting the existing app?

## Captured prototype

Branch: `prototype/prompt-ribbon`
Commit: `995069bd`
Base: `main` at `a2265207`

The prototype branch contains the runnable code, screenshots, and detailed verification in
`docs-internal/specs/prompt-ribbon/prototype.md`.

| Variant | Navigation |
| --- | --- |
| A — Nested List | Quiet parent context and an indented, filled active subsection |
| B — List and Tabs | Prompt list beside subsection tabs above the editor |
| C — Focused List | Subsections replace the prompt list; All Prompts returns to browsing |

Decision: A is selected, with the right-side check marks removed. The filled row identifies
the active destination. The production implementation is authorized, including independent scrolling when the ribbon exceeds the modal height.

## Launch

From the prototype checkout, run `npm run dev -- --host 127.0.0.1 --port 5183 --strictPort`.

[Open variant A](http://127.0.0.1:5183/?variant=A#dev?modal=settings&tab=prompts&subtab=location&surface=system).
The bottom arrows and Left/Right keys cycle A, B, and C.

## Evidence

Verified desktop and mobile, light and dark, Graphite and Purple, system font and JetBrains Mono.
Typecheck and lint passed; lint has one existing warning. Build passed.
Tests: 12,409 passed, 3 skipped, exit 0, 97.89 seconds wall time.
No export shape, version, default, or AI prompt changes.

Revision verification: typecheck, lint, and build passed. The full test run took 99.02 seconds;
12,408 passed, 3 skipped, and the changelog-format check failed. After correcting the entry,
all 14 changelog-format checks passed in 2.19 seconds. Updated light/dark screenshots are on the prototype branch.

## Production implementation

The approved nested ribbon uses the shared selection row without a check mark.
The active section has primary fill; its parent remains quiet context.
Only the active destination has aria-current. The mobile combined selector is retained.

The rail keeps the shared ScrollArea flex layout and min-height constraint.
Its viewport contains overscroll, so scrolling the list does not move the editor.
The design-system guide and live Prompt Navigation reference use the production component.

### Browser evidence

- Settings at 1280 × 720: 484px of rail content in a 399px viewport; wheel scrolling reached the last item.
- Rail scrollTop reached 85.33px; editor top stayed at 402px; document scrollTop stayed at zero.
- All-prompts reference: 740px of content in a 387px viewport; scrolling reached 353.33px and Scene Tags was selectable.
- Mobile at 390 × 844: combined selector visible, rail hidden, page scrollWidth 390px.
- Light and dark Graphite verified; Purple and JetBrains Mono checked against the approved prototype.
- No new automated tests were added for this visual change. Existing navigation tests and live browser checks cover the interactions.

[Final appearance](evidence/production-ribbon-final.png) ·
[Dark scrolling](evidence/production-ribbon-scroll-dark.png) ·
[Light scrolling](evidence/production-ribbon-scroll-light.png) ·
[Mobile](evidence/production-ribbon-mobile.png) ·
[Long list](evidence/production-ribbon-long-list.png)

### Quote-color test follow-up

The quote-color test now waits for the actual picker element to leave the document after Escape,
then finds the accessible theme control. It retains the color edits, reset action, and theme assertions.
The picker implementation is unchanged. Live browser Escape dismissal was also verified.

Focused coverage: 44 tests passed in 14.45 seconds; 100% statements, functions, and lines across the measured controls.
Branch coverage: PromptNavigationRail 95%, CompactSelectionRow 80%, ColorPicker 90.9%.
The uncovered branches are the rail's unknown-label fallback and optional shared-control prop paths.

Mutation check: preventing Escape dismissal made both quote-color cases fail at the removal assertion
in 9.74 seconds. The mutation was restored and the picker source matches its original contents.

Diagnostic runs (wall time): initial full 96.72s; targeted 10.19s; full retry 97.81s;
20-repetition loop 13.44s; full coverage 123.23s; slow interaction 11.18s;
tutorial-first 8.70s; modal suite 14.27s; instrumented full suite 90.87s.
Full coverage added three other failures; focused coverage passed.
The final gate result below is from the normal suite after removing all diagnostics.

### Final gates

- Typecheck: exit 0
- Lint: exit 0; one existing WorldOverviewManager fast-refresh warning
- Clean full suite: 12,409 passed, 3 skipped, exit 0, 92.67 seconds wall time
- Build: exit 0, 17.80 seconds; existing large-chunk warning
- Copy sweep: zero notices on the new navigation and reference components
- Diagnostic logging and the mutation are removed
- Export shapes, app version, defaults, and AI prompts are unchanged

### Subsection typography refinement

Subsections use 12px labels beneath 14px parent labels, with indentation and no left connector line.
Live DOM verification confirmed the sizes and a 0px left border; the filled active row remains.
At 1280 × 720, the rail still scrolls to 85.33px and exposes Scene Tags while the page stays at zero.
The final appearance and dark scrolling screenshots show this refinement.

Follow-up gates: typecheck and lint exit 0 (the existing fast-refresh warning remains),
12,409 tests passed and 3 skipped in 97.09 seconds wall time (exit 0), and build passed in 22.71 seconds.
