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
the active destination. The updated prototype is captured; production implementation is a separate step.

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
