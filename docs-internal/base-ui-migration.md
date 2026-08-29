# Radix → Base UI migration research

Research snapshot from **2026-08-29**, gathered live (npm, shadcn changelog, Base UI docs). The themed-tooltip work (`.scratch/themed-tooltips/`) already ships the first Base UI component; this doc covers migrating the rest. Read this before starting — don't re-fetch what's here. Re-verify only the ⏳ items and current versions.

## Ecosystem state (as of Aug 2026)

| Fact | Detail | Source |
|---|---|---|
| shadcn default | Base UI is the default for new projects since **July 2026**; docs default to Base UI tabs | [shadcn changelog](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default) |
| Radix status | Not deprecated; "keep shipping" guidance for existing apps. Maintenance slowed post-WorkOS; original maintainers left to build Base UI. Still gets releases (react-tooltip 1.2.16, 2026-07-31) | same + npm |
| Base UI package | **`@base-ui/react`** — renamed from `@base-ui-components/react`, which is **frozen at 1.0.0-rc.0**. Never install the old name | npm |
| Base UI stability | Stable 1.0 ~Jan 2026; monthly minors since (1.1.0 Jan → **1.7.0, 2026-08-04**). MUI-backed, long-term maintenance commitment | [InfoQ](https://www.infoq.com/news/2026/02/baseui-v1-accessible/), [releases](https://base-ui.com/react/overview/releases) |
| Migration tooling | Skills-based agent migration (`pnpm dlx skills add shadcn/ui`), per-component commits + reports; built for customized wrappers. Also `shadcn migrate radix` | shadcn changelog |
| Unified Radix pkg | shadcn consolidated `@radix-ui/react-*` into one `radix-ui` package (Feb 2026) — irrelevant if we go Base UI | [changelog](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui) |
| Platform-native future | Interest Invokers (`interestfor` + Popover API): Chrome/Edge 142+ only; WebKit opposes the tooltip use case. Not cross-browser practice yet | [Open UI](https://open-ui.org/components/interest-invokers.explainer/), [caniuse](https://caniuse.com/wf-interest-invokers) |

## Parity: our 18 Radix packages → Base UI

Full coverage. ✅ = same-name component exists.

| Radix dep | Base UI | Notes |
|---|---|---|
| dialog, alert-dialog, popover, context-menu, checkbox, radio-group, slider, progress, separator, tabs, collapsible, scroll-area, select, toggle-group, tooltip | ✅ | Popups gain a required **`Positioner`** wrapper element |
| hover-card | **Preview Card** | Rename only |
| label | **Field** / native `<label>` | Pattern change, trivial |
| slot (`asChild`) | **`render` prop / `useRender`** | The big composition change — see churn |

Bonus components we could adopt: **Drawer** (replaces vaul — see below), Combobox/Autocomplete (potential cmdk/multi-select successor), Toast, Menubar, Navigation Menu, Number/OTP Field, Meter, Avatar, Switch.

## Known API differences

- **`asChild` → `render` prop.** Global change; children still must forward refs. Our asChild-forwardRef lint rule needs a Base UI equivalent.
- **State data attributes differ** from Radix's `data-[state=open]` names. Custom CSS/Tailwind on old attributes **breaks silently** — styles just stop applying.
- **`Positioner` wrapper** around popup content; `side`/`align` move onto it.
- **Checkbox** `checked` is strict boolean. **ToggleGroup** value handling changed (⏳ verify against our segmented-control usage and its clear-on-reclick trap).
- Labels inside popups wrap in a `Group`.
- Tooltip: same touch stance as Radix (no tap-open, hover/focus only; `aria-label` is the accessible layer). Provider-level `delay`, `closeDelay`, adjacent instant-open `timeout`.

## Measured churn in our tree (counted 2026-08-29)

| What | Count |
|---|---|
| `asChild` uses, total | 43 |
| `asChild` outside `src/components/ui/` | 31 |
| `data-[state` selectors outside `src/components/ui/` | 51 |
| Files in `src/components/ui/` (all rewritten by shadcn's Base UI variants; our customizations hand-ported) | 36 |

Custom compositions needing hand-porting: multi-select (incl. `modalPopover` default), date-time-field, list-detail, collapsible-section, plus the wrapper-level customizations (inset focus rings, ScrollArea padding, bordered-arrow popover recipe).

## Adjacent deps

- **vaul** (drawer) depends on `@radix-ui/react-dialog` — verified via npm. Swapping to Base UI's Drawer is what actually removes Radix from the tree.
- **cmdk** is standalone; its shadcn wrapper uses our Dialog. Fine either way; Combobox/Autocomplete is an optional later replacement.
- **react-day-picker** is independent.

## Gotcha re-verification list ⏳

Every one of these was found via a real bug under Radix. Each needs a fresh check under Base UI (some may vanish, some change shape):

- Overlay exit animation (content emptied mid-close when gated on overlay `open`)
- Popover collision boundary (zero-height `<body>` flips portaled popovers)
- react-remove-scroll eating wheel events in non-modal Popover-in-Dialog (the reason multi-select defaults `modalPopover: true`) — Base UI's scroll lock differs; this trap may be gone
- Portal clicks bubbling through the React tree / aria-hidden not reaching portals
- DnD in ScrollArea jitter; TraitTree must never get a bounding-rect modifier
- jsdom testing quirks (portals, unmounted tab panels, silent sub-tab clicks) — Base UI has its own set
- Playwright e2e suite must pass unchanged per component

## Recommended sequencing

1. Tooltip ships first on Base UI (done via `.scratch/themed-tooltips/` — provider + `render`-prop pattern proven, no parity to verify).
2. Migrate component-by-component with shadcn's skills migration: one commit per component, visual/behavior parity verified per piece (both themes, real viewport), gotcha list checked where relevant.
3. Order by blast radius: leaf display components (separator, progress, label) → form controls → popups (popover, select, menus) → dialogs last.
4. Sweep app-code `data-[state` selectors and `asChild` per component as it migrates, not globally.
5. vaul → Base UI Drawer as its own step; then remove the last Radix deps.
