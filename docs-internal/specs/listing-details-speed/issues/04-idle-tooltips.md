# 04: Idle tooltips build nothing

Status: ready-for-human
Base: 44966388
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

App-wide change to a shared primitive, with a prototype decision and accessibility constraints.

## What to build

Spec Q10. A `Tip` that nobody hovers costs almost nothing to render. Prototype both approaches and measure them with the harness: one shared root through Base UI's `Tooltip.createHandle()`, and the real tooltip mounted on first hover or focus. Adopt the one that measures better, in `Tip`, so every surface gains it. Record both measurements and the choice.

## Acceptance criteria

- [x] Both approaches are measured on the warm open; numbers and the choice are recorded under `## Comments`.
- [x] An idle trigger mounts no tooltip root, store, or portal of its own.
- [x] Every trigger has its accessible name from the first render.
- [x] The popup opens on the first hover and on keyboard focus with no added delay, in the right position.
- [x] The existing tooltip tests pass, and a new test fails when an idle trigger mounts a full root.
- [x] Tooltips outside Community Creations are spot-checked in the preview.

## Comments

**Choice: A, one shared root through `Tooltip.createHandle()`** (spec Q10a). `TooltipProvider` mounts the one root and popup; each `Tip` is a detached trigger that hands its text, side and align as the payload.

**Measurements** (`npm run profile:open-speed`, 700 rows, median of 3 runs per arm, this machine). 1× shows no blocks in any arm.

| Arm | Open | visibleMs | Blocks >50 ms | Blocked ms | Tooltip % of script |
|---|---|---|---|---|---|
| Base (root per `Tip`) | 4× cold | 247 | 2 | 307 | 5.5 |
| Base | 4× warm 1 | 169 | 2 | 213 | 6.1 |
| Base | 4× warm 2 | 163 | 2 | 212 | 7.3 |
| Base | 4× reopen | 146 | 2 | 181 | 8.5 |
| A: shared root | 4× cold | 188 | 2 | 238 | 3.4 |
| A | 4× warm 1 | 150 | 1 | 133 | 4.1 |
| A | 4× warm 2 | 144 | 1 | 133 | 4.2 |
| A | 4× reopen | 125 | 2 | 191 | 4.9 |
| B: mount on first use | 4× cold | 206 | 2 | 291 | 0.1 |
| B | 4× warm 1 | 142 | 1 | 131 | 0.2 |
| B | 4× warm 2 | 143 | 1 | 133 | 0.3 |
| B | 4× reopen | 122 | 1 | 109 | 0.5 |

- A and B tie on blocking and `visibleMs` within run noise. B wins only the tooltip share.
- B as measured remounts the control on first hover or focus: focus is lost and the first hover does not open. Base UI's trigger can't attach to an element it didn't render, so a correct B would reimplement the trigger (hover intent, delay group, focus, Escape, close on click). Out of scope per Q10a.
- A side effect of A: a tip that mounts in the same commit as the provider (app start only) gets its ref detached and re-attached once, when the shared root joins. The ref ends on the right element. The ref test now checks that outcome instead of a call count (user's call).
- A `Tip` with no `TooltipProvider` above it never opens. The app and the site mount one; tests that hover a tip now render the provider too.

**Spot-check** (headless Chromium against the dev server, 1440×900, base and A run by the same script):

- Main menu: 9 triggers, all named. First hover opens at 408–420 ms (the 400 ms delay), keyboard focus opens in under 40 ms, 6 px from the trigger, centered or shifted inside the viewport, on top.
- World Editor (New World): 47 triggers, all named. 29 of 38 visible tips open on hover, identical to base. The 9 that don't are 7 disabled buttons plus **Find and replace** and **Test Bench**, which open on focus. Both behave the same on base.
- The `#dev` routes into Settings and the World Editor left the app empty with either `Tip`, so the check reached the World Editor by clicking **New World** instead.

**Review** (`e8670a55`): folded in a shorter ref-test comment, `TipPayload` built from `TipProps`, and accurate changelog and `App.tsx` wording. Left open: `DemoAINotice.tsx` and `MainMenu.tsx` still compose their own `Tooltip` root (one instance each); no test pins the 400 ms first-hover delay; nothing warns when a `Tip` renders with no provider.
