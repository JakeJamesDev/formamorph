# Spec: Local-Network Embed Guidance (Pop-Out Button + Setup Guide Cause)

Status: ready-for-agent

## Problem Statement

Browsers (Chrome 142+, Edge, and Firefox, all ramping through 2026) now gate requests from public
websites to local/private addresses behind a "Local Network Access" user permission. A top-level
page gets a permission prompt; a cross-origin iframe only gets the permission if the embedding page
delegates it — and itch.io's game embed does not. So a player running Formamorph inside the itch
embed can never connect to LM Studio, Ollama, or any other server on their own machine or LAN: the
fetch is denied by the browser before it leaves, and the app shows the generic "Can't reach your
endpoint" gate. The player then wastes time checking their server, URL, and CORS — none of which
are the problem — because nothing tells them the embed itself is the blocker or that opening the
game in its own tab fixes it. Incidence grows over time as the browser rollout reaches more
profiles.

## Solution

When the app is running inside a cross-origin iframe, the configured custom endpoint points at a
local/private address, and the reachability probe fails, the setup gate says what is actually
wrong — "the site embedding this game blocks connections to servers on your machine" — and offers
a one-click **Open in a New Tab** button. The new tab is a top-level page on the same origin, so
the browser shows its local-network permission prompt, the player allows it, and everything works;
saves and settings carry over because the origin is unchanged. The LLM setup guide gains the same
situation as a new first cause in its checklist, telling embedded players to pop out and everyone
else what the permission prompt looks like.

## User Stories

1. As an itch player with LM Studio running, I want the setup gate to tell me the embed is blocking the connection, so that I don't waste time debugging a server that is working.
2. As an itch player, I want an Open in a New Tab button right on the setup gate, so that I can fix the problem in one click instead of hunting for a workaround.
3. As an itch player who popped out, I want my saves, settings, and endpoint config present in the new tab, so that popping out costs me nothing.
4. As an itch player who popped out, I want the game to connect after I allow the browser's local-network prompt, so that the promised fix actually completes.
5. As a player on the top-level web build (e.g. GitHub Pages), I want no embed-related noise in the gate or guide, so that the guidance only appears where it applies.
6. As a desktop-app player, I want no embed-related guidance ever, so that irrelevant browser advice never reaches a context it can't apply to.
7. As a player whose endpoint is a hosted/public URL, I want the embed guidance suppressed even inside an iframe, so that a genuinely down cloud endpoint isn't misattributed to the embed.
8. As a player reading the LLM setup guide inside an embed, I want the embed cause listed first with the pop-out remedy, so that the most likely cause is the first thing I try.
9. As a player reading the guide on a top-level page, I want a hint that the browser may show a local-network permission prompt I need to allow, so that I don't dismiss the prompt and then wonder why the connection fails.
10. As a player who denied the permission prompt earlier, I want the guide's hint to mention re-allowing it from the browser's site settings, so that a mis-click isn't permanent confusion.
11. As a player inside an embed whose server genuinely is off, I want the gate to still surface the ordinary checks (server running, URL right), so that popping out isn't presented as the only possible fix.
12. As a player, I want the pop-out to open via a real click, so that popup blockers don't eat the new tab.
13. As a player in the popped-out tab, I want the gate's existing auto-resume polling to detect the now-reachable endpoint, so that the game continues without a manual retry.
14. As a mobile player in an embedded browser view, I want the same guidance to appear when the same conditions hold, so that the remedy isn't desktop-only.
15. As a developer, I want the embed/address detection in one pure module with unit tests, so that the classification logic is provable without a browser.
16. As a developer, I want the changelog to record the player-facing change, so that the release notes explain the new button and message.

## Implementation Decisions

- **New pure detection module** (the single new seam) exporting roughly:
  - an address-space classifier: given an endpoint URL, is its host loopback (`localhost`,
    `127.0.0.0/8`, `::1`) or private (`10/8`, `172.16/12`, `192.168/16`, `.local`, single-label
    hostnames)? Everything else is public.
  - a cross-origin-embed check: `window.self !== window.top`, treating a thrown access error as
    cross-origin. Injected/parameterized so tests don't need a real iframe.
  - a combinator: embed + local-or-private endpoint + failed probe → offer the pop-out guidance.
- **`AiBlocker` stays unchanged.** The probe cannot distinguish a Local Network Access denial from
  a server that is off (the rejection is an opaque `TypeError`; the specific message is
  console-only). The embed situation is therefore a *presentation-layer refinement* of the existing
  `unreachable` blocker, layered on in the gate/guide — not a new probe outcome.
- **Setup gate**: when the refinement applies, the unreachable branch swaps its title/description
  to name the embed as the likely blocker and adds a primary **Open in a New Tab** button
  (`window.open` of the current URL from the click handler). Existing behavior — polling,
  Try again, Open Settings, Continue anyway — is unchanged; the ordinary causes remain mentioned.
- **Setup guide**: gains a new first cause ("Playing inside another site's embed?") shown only when
  the embed check is true, with the pop-out remedy; and the existing causes gain a short note that
  the browser may show a local-network permission prompt that must be allowed (with a pointer to
  re-allow via site settings if previously denied).
- **Permissions-policy introspection** (e.g. `document.permissionsPolicy.allowsFeature`) may be
  used as a *strengthening* signal where available, but absence of the API must not weaken the
  heuristic — verify the exact API name/behavior against current browsers at implementation time,
  not from recall.
- **No export-shape, settings, or save changes.** Pure UI + one lib module.
- Changelog: one 👤 In-Progress entry.

## Testing Decisions

- Good tests here assert external behavior of the pure module: URL string in → classification out;
  flag combination in → offer/suppress decision out. No DOM, no fetch, no mocked window globals
  beyond the injected embed flag.
- Address classifier cases: `localhost` (any port/protocol), `127.0.0.1`, `[::1]`, `192.168.x.x`,
  `10.x.x.x`, `172.16–172.31.x.x` (and the near-misses `172.15`/`172.32`), `something.local`,
  single-label hosts, public domains, public IPs, and unparseable URLs (fail safe: treated as not
  local → no embed guidance).
- Combinator cases: all eight combinations of embed × local-address × probe-failed; only the
  triple-true offers the guidance.
- Prior art: the probe-memo and AI-reachability unit tests (pure lib modules tested with vitest,
  no component render).
- UI wiring is verified live in the preview (dev-router + static evidence), per the project's UI
  bar; the copy renders in both themes. No jsdom component test (user decision).
- The pop-out click and the real permission prompt can only be proven manually on the deployed
  builds (itch + GitHub Pages); the spec's automated bar is the pure module.

## Out of Scope

- Changing probe semantics, adding a new `AiBlocker` value, or trying to read the browser's
  specific denial message.
- Requesting the local-network permission programmatically, or any permissions API beyond the
  optional strengthening check.
- The desktop app (never in an iframe) and the bundled local engine path.
- Fixing the embed itself — that requires itch.io adding `allow="local-network-access"` to their
  iframe (worth reporting to them separately).
- Any banner outside the gate/guide surfaces (explicitly not chosen).
- Mitigating the slow context-length detection while a permission prompt is pending.

## Further Notes

- Root-cause evidence: browser console on the itch embed shows
  "Permission was denied for this request to access the `local` address space" — emitted by the
  browser, not the app. Top-level builds show a `local-network` permission prompt and then work.
- The player's endpoint may be a LAN IP (e.g. `192.168.1.100`), not just `localhost` — that is why
  the classifier covers private ranges, and why the guidance wording should say "on your machine or
  local network," not just "on your computer."
- Rollout context: Chrome 142 (Oct 2025) with server-side ramp into 2026 and an enterprise opt-out
  ending ~M152; Firefox shipped an equivalent prompt. Expect rising player reports until the
  pop-out guidance ships.
