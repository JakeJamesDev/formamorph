# Enter World consistency review

Status: awaiting product review. No production implementation is approved.

## Question

Should the approved Enter World flow adopt consistent choice controls and explicit dictionary states? Should dictionary selection and ordering share one list?

## Captured prototype

- Branch: `prototype/enter-world-consistency`
- Commit: `818148f8` — Prototype Enter World Consistency
- Worktree: `C:/Users/benny/.codex/worktrees/1660/formamorph`
- Launch there with `npm run prototype:enter-world`.
- [Open the comparison](http://127.0.0.1:5181/?variant=C#dev?modal=enterWorld).
- Detailed review and desktop/phone screenshots are in `docs-internal/specs/enter-world/consistency-prototype.md` on the prototype branch.

## Choices

| Variant | Scope |
| --- | --- |
| A | Current layout and controls, with a prototype comparison bar. |
| B | Consistent choice styling, semantic card backgrounds, Title Case headings, dictionary enabled state. |
| C | B plus combined dictionaries and entities using the World Editor row components, with separate item details. |

The approved category hierarchy, mobile disclosure, selection ratios, and footer remain. Sample state stays in memory. Avatar continuation and saved defaults are demonstrations.

## Review outcome

C is the user's likely preference. The user approved adapting C to World Editor lists for this surface. The updated prototype is ready for review; this does not establish an app-wide standard or approve production implementation.

Typecheck, targeted lint, and production build passed. Desktop and phone checks covered retained choices, optional radio deselection, dictionary state/order, and light/dark appearance. Writing compliance, actual artwork loading, deep hierarchy stress cases, real game handoff, and touch dragging remain outside this prototype's verified scope.


## Portrait iteration

C now responds to container width: Categories collapses below 72rem of dialog width, and the library switches from split panes to full-width list/details below 44rem of library width. The user authorized trying this approach; visual approval is pending.

Checked at 1365, 820, 768, and 390px viewport widths. Choices, ordering, inspection, and search survived resizing; phone Back preserved list scroll and restored focus. Typecheck, targeted lint, and build passed. Captures and timings are recorded on the prototype branch.
