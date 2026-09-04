# 05 — Playwright hover spec

Status: done
Blocked by: 03

One spec in the existing e2e suite (`npm run test:e2e`) on a representative surface:

- Hover opens the themed tooltip (assert visibility/content, never seconds).
- Moving to an adjacent control opens its tip via the instant-open window.
- Focus via keyboard opens the same tip.

Follow the suite's existing patterns (port 5183, two viewports where relevant).

## Comments

**Surface.** The Main Menu's Grid/Detailed view toggle, in `e2e/tooltip-hover.spec.ts`. Two icon-only
controls side by side, both wrapped in `Tip`, reachable with no server and no world loaded — and already
the surface ticket 01 proved live, so a failure here reads against a known-good baseline.

**Locating the bubble.** There is no `getByRole` for it: a Base UI popup carries no role, deliberately.
The spec finds it by text, which is unambiguous precisely because these triggers are icon-only — the
string exists nowhere else on the surface. Playwright's text engine returns the innermost match, so the
positioner and portal wrapping it do not also match.

**`timeout` is not what makes the handoff instant.** Setting the provider's `timeout` to 0 was the
obvious mutation for the adjacent-window guard, and it left the spec green: moving straight from one
trigger to its neighbor hands over instantly whatever that value is. `timeout` only governs how long the
group keeps its zero delay *after* the last tip closes. What makes two tips one group is the shared
provider, so the mutation that turns the guard red is unmounting it (`TooltipProvider` rendering a bare
fragment) — that failed exactly one test and left the other two green.

**Guards proved by mutation.** Dropping `Tip` from the Grid control and giving the button a plain
`aria-label` instead — the pre-sweep shape — turns all three red. Unmounting the provider turns only the
instant-window test red. The first tip is asserted to carry *no* `data-instant`, which is what keeps the
second tip's assertion from being true of every tip regardless of the group.

**No stopwatch anywhere.** The instant window is read off `data-instant`, the state Base UI publishes for
it. A ms assertion against a 400 ms delay is a flake generator, and the project bars timing claims.

**A harness race worth naming.** The bundled worlds are seeded into IndexedDB after the menu mounts, and
the re-render that follows cancels a hover still counting down its delay. The pointer is already parked
by then, so nothing re-opens it and the tip never arrives — a 5 s timeout does not save it. `openMenu`
waits for a world card's Delete button first. The same thing is reachable by a real player who hovers a
toolbar button in the first second on the Main Menu; too small to chase here, but it is a real edge and
it is Base UI's hover handling, not ours.

**Viewports.** Both hover guards skip on `mobile` — a touch profile has no hover, and the native `title`
they replace never showed there either. The keyboard-focus guard runs on both and passes on both.

**Gates.** typecheck 0 · lint 0 errors (2 pre-existing tsdoc warnings in `localNetworkEmbed.ts`) · 6865
tests pass in 39.6 s · build 13.9 s. Full e2e: 72 passed, 28 skipped, 4.1 min. The new spec run three
times over on both projects: 12 passed, 6 skipped, 1.3 min, no flakes.
