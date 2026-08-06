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

[prompt-editor.spec.ts](e2e/prompt-editor.spec.ts) — the prompt editor's layout, chrome gating and
caret. Each guard was verified by putting its bug back and watching the test go red.

## CI

Not wired into a workflow yet. `npm run test:e2e` is CI-ready (it retries once and reports in
GitHub's annotation format when `CI` is set), but it needs a `playwright install --with-deps
chromium` step, so adding it is a deliberate choice rather than a default.
