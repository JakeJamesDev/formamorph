# 04 — Tail sweep, lint guard, dep cleanup

Status: done
Blocked by: 02, 03

- Migrate every remaining native `title` on DOM elements (audit via grep; the ~197 count includes component props — sort each hit into the spec's buckets).
- Add the eslint rule forbidding `title` on DOM elements, at error level. Component props named `title` stay allowed.
- Remove the unused `@radix-ui/react-tooltip` dependency.
- Changelog In-Progress entry for the themed tooltips (player-facing bucket).

Gates green; lint proves zero remaining native titles.

## Comments

**Audit.** The rule itself was the audit: written first at error level, it enumerated the work. 42 native
`title` attributes on DOM elements in 25 files — then 85 in 38 files once the rule also covered the
components that spread their props onto a DOM node, where a capital letter hides a browser tip.
`<Button title=…>` alone accounted for 33 of them. The `~197` grep count was mostly component props;
after the sweep 178 `title=` hits remain and every one is a component's own API (`Section`,
`ConfirmDialog`, `FullscreenShell`, the dialog shells) — each verified to destructure `title` rather
than spread it.

**The guard.** `eslint.no-native-title.js` (`formamorph/no-native-title`), error level on `src/**/*.tsx`,
which is every `.tsx` in the repo. It reports `title` on any lowercase JSX element, and on the five
pass-through components (`Button`, `ToggleGroupItem`, `Checkbox`, `RemoteImg`, xyflow's `Handle`).
`iframe`/`svg`-family elements are exempt: there `title` is a documented accessible name.
Proved by mutation — a probe file with `<span title>`, `<Button title>`, `<iframe title>` and a real
component prop reported exactly the first two.

**Bucket calls worth recording.**
- Icon-only controls whose `aria-label` repeated the `title` dropped both and took `tip` alone.
- Where the `aria-label` said more than the tip (`Dismiss: <headline>`, `Reset terms for <user>`,
  `Test Bench, 3 new findings`), the label stayed and the tip took `labelsChild={false}`.
- **Two tips were deleted rather than converted.** The VRAM bar's own-usage sliver repeated the legend
  printed directly under it, under the same condition. The messages list's "Edited" stamp repeated its
  own visible line word for word — same formatter, same date.
- **New tab stops**, following ticket 02's split: the pinned-message marker, a dictionary row's
  enabled-of-total count, and the profile stat readouts. `ProfileStats` keeps its `sr-only` word rather
  than letting the tip name it — that span has no role, and ARIA does not allow a label on a generic
  element, so the reliable mechanism stays and the tip only puts the same words on screen.
- Dense repeated inline content still takes none: the anatomy chips, the canvas nodes, the model-path
  lines.

**Accessible naming in the Request Anatomy, decided by label-in-name.** A marked run's text is narration
content, and a chip's pill is its label, so both keep naming themselves (`labelsChild={false}`); the
source chip ("System Prompt") and its tip ("Open the System Prompt") agree, so there the tip names it.
Three test suites moved off `title` onto the accessible name, and the two chip locators now find the
chip by its own word rather than by tooltip copy.

**The canvas controls, closed in a follow-up.** This ticket first recorded xyflow's zoom buttons as
unfixable: `ControlsComponent` has no prop that separates `title` from `aria-label` (both come from one
`ariaLabelConfig` string), and its `ControlButton` is a plain function that never receives the ref a
trigger needs. Both are true, and the verdict was still wrong — the prop list is not the option space.
`Controls` renders `children` inside its own panel, and `ControlButton` is four lines around
`<button className="react-flow__controls-button">`. So `src/components/CanvasControls.tsx` turns the
built-in trio off and supplies our own tipped buttons, using the same `useReactFlow()` zoom helpers and
`useStore` min/max-zoom selectors that `Controls` uses internally. Both canvases route through it —
the editor's, which hangs its full-screen toggle off the end, and the player's in-game map.
`index.css` now sets `fill: none` on icons in those buttons: every glyph in there is a stroked lucide
icon since xyflow's solid ones left with its buttons.

**A disabled control still cannot raise a tip.** A browser *does* show `title` on a disabled button, so
every conditionally-disabled control converted here loses its hint while disabled: Replace and Replace
all in the find bar, the scene image's Previous/Next, Reset terms, and the rest. In one place that is
the whole point of the string — `EntityModal`'s "Available once the story is done generating" is now
unreachable copy, the same shape ticket 03 recorded for the memory manager. The fix in every case is a
wrapper element around the control, which is a product call, not a sweep one.

**`RemoteImg` now forwards its ref** (`src/lib/useRemoteImage.tsx`) so the entity gallery and the swipe
image can carry tips. It joins `Handle` in `REF_SAFE_COMPOSED_CHILDREN`.

**Dependency.** `@radix-ui/react-tooltip` removed; it was never imported anywhere.

**Test relocations.** 37 tests across 14 files queried a `title` the sweep removed. Where the tip became
the accessible name they re-locate by role name. Where it did not, they hover and read the tip —
`userEvent.hover` opens a Base UI tooltip in jsdom (measured ~600 ms for the first, instant after,
since the provider's group window is shared), so the original assertions kept their strength rather
than degrading to "a trigger is attached". The one exception is `StatManager`'s coverage bar, which
enumerates segments structurally and now finds them by `data-base-ui-tooltip-trigger`.

**Gates.** typecheck 0 · lint 0 errors (2 pre-existing tsdoc warnings in `localNetworkEmbed.ts`) ·
6865 tests pass in 42.6 s · build 16.7 s.

**Live proof.** Dev server at 1440x900, seven dev routes swept at runtime: main menu, settings,
community, World Editor stats and entities, memory manager, model details. The only native `title`
left in the live DOM anywhere is xyflow's three control buttons; 173-177 themed triggers are live.
The find bar's Match case tip measured off computed styles in both themes — dark `bg rgb(29,32,37)` /
`fg rgb(244,244,246)` / `border rgb(55,59,67)`, light `rgb(252,252,253)` / `rgb(26,29,35)` /
`rgb(221,223,228)`, each matching its `--popover` / `--popover-foreground` / `--border` token, both at
`text-helper` 14px.
