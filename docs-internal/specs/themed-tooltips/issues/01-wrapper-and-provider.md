# 01 — Tooltip wrapper, provider, and contract test

Status: done

Build the Base UI tooltip module per the spec's Implementation Decisions:

- Add the `@base-ui/react` dependency (current package name; NOT `@base-ui-components/react`).
- Create the shadcn-style tooltip module in the ui collection: composable parts + the one-line `tip` convenience component. Empty/undefined tip returns the child unchanged.
- Mount the provider at the app root with the shared delay (~400 ms) and adjacent instant-open window.
- Style with existing popover tokens, both themes, Base UI state data attributes, reduced-motion respected.
- Decide and document the aria-label handling (tip doubles as label when the child has none, or call sites pass both).
- Wrapper contract test (vitest/jsdom, following the dialog/scroll-area test pattern): focus opens content, aria-label survives, empty tip = bare child, trigger composes without extra wrapper element.
- Prove it live on one surface via the dev-router, both themes, static frames.

Gates green. This ticket blocks all others.

## Comments

**Decisions made here, for the sweep tickets to follow.**

- **Module**: `src/components/ui/tooltip.tsx`. Parts are `Tooltip` (root), `TooltipTrigger`, `TooltipPortal`,
  `TooltipPositioner`, `TooltipPopup`, `TooltipProvider`. The one-line form is `Tip`.
- **aria-label**: `Tip` applies the tip text as the child's accessible name when the child has neither
  `aria-label` nor `aria-labelledby`. Base UI's popup carries no role and is never announced, so without
  this an icon-only control would lose its name outright. `labelsChild={false}` opts out where the child's
  visible text already names it; `labelsChild` (true) forces it on.
  **Sweep rule**: an icon-only control drops both `title` and `aria-label` and takes `tip` alone. Terse
  visible text takes `tip` plus `labelsChild={false}` unless the tip is a better spoken name.
- **Timing**: `delay` 400 ms and the adjacent-group `timeout` 400 ms, both on the provider in `App.tsx`.
  No call site may set timing.
- **Lint**: `eslint.aschild-forwardref.js` became `eslint.composed-forwardref.js`
  (`formamorph/composed-forwardref`). It now also flags an unforwarded component under `render={<X/>}` and
  under `<Tip>`. Add verified components to `REF_SAFE_COMPOSED_CHILDREN`.
- **No arrow part.** Base UI ships `Tooltip.Arrow`; the popover's bordered-arrow recipe was not ported
  because tips read fine without one. Add it later if a surface wants it.
- **Live proof**: the main menu's Grid/Detailed view toggle. Both themes measured off computed styles —
  popover surface, foreground and border tokens correct in each. `data-instant="delay"` was observed on the
  second tip when moving between the two, which is the shared-provider instant-open group firing.

