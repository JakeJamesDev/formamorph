# Browser tests (Playwright)

A small suite that runs the real app in a real browser. It is **not** part of `npm test` — the four
gates stay fast, and this runs on its own.

```bash
npm run test:e2e
```

First time on a machine (downloads the browser, ~115 MB):

```bash
npm run test:e2e:install
```

| Command | What it does |
| --- | --- |
| `npm run test:e2e` | Both viewports, headless |
| `npm run test:e2e -- --project=desktop` | One viewport |
| `npm run test:e2e -- --headed` | Watch it drive |
| `npm run test:e2e:ui` | Playwright's time-travel UI — the fastest way to debug a failure |

The runner starts its own dev server on **5183** (`--strictPort`), so it never fights the servers on
5180–5182. An already-running one on 5183 is reused; set `E2E_PORT` to move it.

## What belongs here

Only failures that a browser can see and jsdom structurally cannot:

- 📐 **Real layout** — element boxes, overlap, caret rects. jsdom reports every rect as zero.
- 🖱️ **Real hit-testing** — `pointer-events`, stacking, one thing covering another. A dispatched
  `click()` lands on a dead overlay just as happily as a live one.
- 📱 **Real viewport behavior** — anything gated on window size or touch.

Everything else is cheaper and clearer as a Vitest test. If a guard could be written against a pure
function or a rendered tree, write it there instead.

## Viewports

| Project | Size | Why |
| --- | --- | --- |
| `desktop` | 1280 × 860 | The split layout only exists this wide |
| `mobile` | 375 × 812 | `hasTouch`, so touch-gated chrome renders |

Both projects run every spec; a spec that only makes sense on one calls `test.skip` on the project
name, which is why the run reports skips.

## Getting somewhere

Specs navigate with the DEV-only dev-router rather than clicking through menus:

```ts
await openApp(page);                       // seeded localStorage, past the intro and the setup gate
await openPromptEditor(page);              // Settings → Prompts, on an editable preset
await gotoDev(page, 'gameViewer', { tab: 'memory' });
```

Helpers live in [app.ts](e2e/app.ts). The router itself is [devRoutes.ts](src/lib/devRoutes.ts) — it
is stripped from production builds, which is why these tests need `npm run dev` and not `preview`.

> **Editable preset:** the shipped prompt presets are read-only, and a read-only editor takes no
> caret. `openPromptEditor` creates a user preset first, through the real UI.

## Coverage today

[prompt-editor.spec.ts](e2e/prompt-editor.spec.ts) — the prompt editor's layout, chrome gating, caret,
focus behavior, and dropdown scrolling. Each guard was verified by putting its bug back and watching the
test go red.

Two caveats worth knowing:

- **Focus, not the keyboard.** There is no soft keyboard to drive, so the specs measure what *summons*
  one: who holds focus, and whether that opens or re-opens full screen. The keyboard-stuck-open loop
  itself is still only reachable on a real phone.
- **Wheel events, not `scrollTop`.** Radix drives its dropdown chevrons off its own scroll handling.
  Setting `scrollTop` from a script leaves exactly one chevron mounted and reproduces nothing;
  `mouse.wheel` reproduces the reflow (the list jumped 334 → 358px before the fix). Any future scroll
  spec has to use real input.

## The contest flow needs a server

[contest-entry.spec.ts](e2e/contest-entry.spec.ts) publishes a world into a running contest and finds it
again in the Contest tab. It is the one spec that talks to a real
[FormamorphServer](https://github.com/JakeJamesDev/FormamorphServer), so it **skips unless you point it at
one** — `npm run test:e2e` on a machine without one reports it as a skip, never a failure.

```bash
E2E_API_URL=http://localhost:8797/api npm run test:e2e -- --project=desktop
```

Setting `E2E_API_URL` hands that base to the dev server as `VITE_API_URL_DEV` and stops it reusing an
already-running one — a server started without the override still points at the live workshop, and
publishing a test world there is not a mistake worth risking. The spec also blocks every off-machine
request as a second belt.

### Seeding a scratch server

From a FormamorphServer checkout, against throwaway directories so your own local data is untouched
(the last line runs the server, so give it its own shell):

```bash
export DATA_DIR=/tmp/e2e/data DB_PATH=/tmp/e2e/data/e2e.db STORAGE_ROOT=/tmp/e2e/storage JWT_SECRET=e2e
ADMIN_USERNAME=e2eadmin ADMIN_PASSWORD=e2eadminpass node src/utils/initDb.js
PORT=8797 node src/server.js
```

Then log in as that admin and `POST /api/events` a contest whose `startsAt` is in the past and `endsAt`
in the future (`type: "contest"`, plus `title`, `bannerText`, `body`). The spec finds it through
`GET /api/events/active` and skips with a note if there isn't one.

Each run registers its own account, because a contest takes one entry per creator — so the flow is
repeatable, but the server's credential limiter (20 per 15 minutes per IP) caps a debugging loop.

## CI

Not wired into a workflow yet. `npm run test:e2e` is CI-ready (it retries once and reports in
GitHub's annotation format when `CI` is set), but it needs a `playwright install --with-deps
chromium` step, so adding it is a deliberate choice rather than a default.
