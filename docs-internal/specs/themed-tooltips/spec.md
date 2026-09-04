# Themed Tooltips on Base UI

Status: done
Status note: all five tickets shipped; in the changelog under Hover tips

## Problem Statement

Every hover tip in the app is a native `title` attribute. The browser renders these: they are unthemed, ignore the app's light/dark palette, appear after a fixed ~1s browser delay, cannot be styled or positioned, and look different per browser and OS. In a game that otherwise has a complete visual identity, these tips read as unfinished. They also do nothing for keyboard focus in most browsers.

## Solution

A single themed tooltip component, built on Base UI (the successor library the shadcn ecosystem now defaults to), replaces every native `title` tooltip. Tips match the app theme in both modes, open on hover and on keyboard focus, open instantly when moving between adjacent controls, and are positioned and animated consistently. A lint rule prevents new native `title` tooltips from creeping back in. This is also the first Base UI component in the tree, and it establishes the wrapper pattern the future Radix-to-Base-UI migration will follow (see `docs-internal/base-ui-migration.md`).

## User Stories

1. As a player, I want hover tips that match the game's theme, so that the UI feels finished rather than falling back to browser chrome.
2. As a player, I want tips to appear with a short, consistent delay, so that they feel responsive instead of the browser's sluggish default.
3. As a player, I want the next tip to appear instantly when I move between adjacent icon buttons, so that I can scan a toolbar quickly.
4. As a player using dark mode, I want tooltips that render in the dark palette, so that a bright OS-default tip never flashes over a dark scene.
5. As a keyboard user, I want tooltips to open when a control receives focus, so that I get the same hints a mouse user gets.
6. As a screen-reader user, I want icon buttons to keep their accessible names, so that the themed tip never replaces or degrades what my reader announces.
7. As a touch player, I want icon buttons to keep working exactly as before, so that the tooltip change costs me nothing (native tips never showed on touch either).
8. As a player with reduced motion enabled, I want tooltips to appear without animation, so that the setting is respected.
9. As a player in the game view, I want the panel and toolbar icon buttons to explain themselves on hover, so that I can learn the UI without opening help.
10. As a world author, I want the editor row action icons to show themed tips, so that dense editor toolbars stay learnable.
11. As a world author, I want terse meta text (counts, badges) to expand into a readable tip on hover, so that abbreviations do not block understanding.
12. As a community user, I want browse-and-listing controls to show themed tips, so that the community surfaces match the rest of the app.
13. As a user reading settings, I want the existing click-to-open info popovers left exactly as they are, so that definitions stay a deliberate click, not a hover.
14. As a player hovering a non-interactive status icon (for example the Experimental marker), I want the tip to also be reachable by keyboard, so that the information is not mouse-only.
15. As a developer, I want one one-line tooltip component, so that adding a tip costs no more than the `title` attribute did.
16. As a developer, I want a lint error when I put a `title` attribute on a DOM element, so that unthemed tips cannot return silently.
17. As a developer, I want tips that receive no text to render the child untouched, so that conditional tips need no call-site branching.
18. As a maintainer, I want this wrapper to be the first Base UI component in the codebase, so that the later component-by-component migration has a proven pattern and provider already in place.

## Implementation Decisions

- **Library**: the `@base-ui/react` package (note: renamed from `@base-ui-components/react`, which is frozen at an RC; never install the old name). Stable, MUI-maintained, monthly release cadence, and the shadcn default since July 2026. It coexists with the existing Radix packages; nothing Radix is touched.
- **Wrapper shape**: a shadcn-style tooltip module in the ui component collection exposing the composable parts (provider, root, trigger, positioner, popup) plus a one-line convenience component that takes `tip` text and a single child. The convenience form is what the sweep uses; the parts stay exported for unusual layouts.
- **Empty tip = no machinery.** When `tip` is empty or undefined the convenience component returns the child unchanged, mirroring the existing pattern where a help surface with no copy renders nothing.
- **Provider**: mounted once at the application root. It owns the open delay (about 400 ms) and the adjacent instant-open window, so per-call-site timing config is not needed and not allowed.
- **Composition**: Base UI's `render` prop, not Radix's `asChild`. Trigger children must forward refs; the wrapper documents this and the existing forwardRef lint guard is extended or mirrored for the new trigger.
- **Styling**: existing popover design tokens, both themes, Base UI's state data attributes (not Radix's `data-[state=…]` names) for enter/exit styling, honoring reduced motion.
- **Accessibility contract**: the tooltip is a visual label only. Icon-only controls keep `aria-label`; the tip text and the label stay the same string at call sites (one constant, used twice, or the convenience component applies the tip as the label when the child has none — decided in the wrapper ticket).
- **Touch**: Base UI tooltips do not open on tap, by design. This is parity with native `title`. No long-press or tap alternative is built.
- **The sweep sorts every native `title` into three buckets**: icon-only controls become tooltip plus `aria-label`; truncated or terse visible text becomes tooltip only; `title` values that only served as an accessible name become `aria-label` only, with no tooltip. Non-interactive tip carriers become keyboard-focusable.
- **Shared components first**: the editor row action abstraction already centralizes its actions' `title` strings, so converting it migrates dozens of call sites in one edit. Other shared chrome (utility components, prompt field chrome) follows the same route before per-file work starts.
- **Lint guard**: after the sweep, an eslint rule forbids the `title` prop on DOM elements (component props named `title` remain fine). It lands at error level in the final ticket so intermediate tickets stay green.
- **Dependency cleanup**: the never-used Radix tooltip package is removed in the final ticket.
- **Explicitly unchanged**: the settings info popovers (click-to-open definitions) and the help button system are separate surfaces and keep their current behavior.

## Testing Decisions

- Good tests here assert external behavior: what the user sees appear and what assistive tech is given — never Base UI internals, class lists, or timer counts.
- **Wrapper contract test** (the one new seam, vitest and jsdom, following the existing ui component test pattern used by the dialog and scroll-area tests): tooltip content appears on keyboard focus (focus is deterministic in jsdom; hover timing is not), the child's `aria-label` survives wrapping, an empty tip renders the bare child with no tooltip machinery, and the trigger composes onto an existing button without adding a wrapper element.
- **One Playwright hover spec** in the existing e2e suite proves real hover-open and adjacent instant-open on a representative surface, since jsdom cannot prove pointer hover. Per project rules, no timing-in-seconds assertions; assert visibility states.
- **The sweep itself gets no per-site tests.** Its regression guard is the eslint rule; its verification is static-frame preview evidence per surface, both themes, per the standard UI change bar.
- Existing suites (ui component tests, game panels harness, e2e) must stay green in every ticket.

## Out of Scope

- Migrating any other Radix component to Base UI. That research and plan live in `docs-internal/base-ui-migration.md` and proceed later, one component at a time, precisely because those have visual and behavioral parity to verify and this one does not.
- Touch-specific tooltip behavior (long-press, tap-to-show).
- The settings info popover system and help buttons.
- Rich tooltip content (markdown, interactive content). Text only; anything richer belongs to the popover system.
- Replacing the drawer (vaul) or command (cmdk) dependencies.

## Further Notes

- Full research backing the library choice — ecosystem status, parity table, measured migration churn, and the gotcha re-verification list — is in `docs-internal/base-ui-migration.md`. Read it before starting the broader migration; do not re-fetch what it already records.
- The grep count for `title=` literals (~197 across 64 files) overcounts: many are component props. Each sweep ticket audits its own files rather than trusting the count.
- Tickets under `issues/` split the work: wrapper and provider, shared components, hot-spot files, then the tail sweep with the lint guard and dependency cleanup.
