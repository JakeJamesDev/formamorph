# 📝 Changelog

All notable changes to Formamorph. This fork's first line is **2.0.0** — a full TypeScript rebuild of the upstream JavaScript app ([FieryLionite's Formamorph](https://fierylion.itch.io/formamorph), ~v1.2) — with feature parity as the baseline plus new features on top.

> 🚧 **2.0.0 is in development and not yet released.** Entries accumulate here as work lands. When the version number is bumped, that marks 2.0.0 going live; until then this is a living list.

Each release groups changes as **Major** / **Minor**, then **Added** / **Removed** / **Fixed**, and within those by audience: 👤 user-facing · 🛠️ developer tooling · ⚙️ backend / invisible.

---

## 🚧 2.0.0 — In development

Everything below is relative to the point this fork diverged from upstream.

### Major Changes

#### ➕ Added

- **👤 User-facing**
  - **Custom 3D avatars** — bring your own `.vrm`, or set a per-world custom player model.
  - **In-app media player** — a fully themed audio widget for TTS narration, with auto-generated TTS when the model is loaded and a one-click unload of the TTS model to free VRAM.
  - **Redesigned world browser ("Discover")** — card-grid layout, tag & author chip search/filtering, and world-preview image zoom.
  - **AI output controls** — automatic paragraph limits and length-based truncation, an optional "thinking / planning" step before the reply, and a smoothed character-by-character reveal of streamed text.
  - **Markdown narration** — the AI can format story text with bold/italic, bullet & numbered lists, tables (e.g. inventory), headings, blockquotes, and code; it renders live as the text streams in.
  - **Token-based Context Window**, auto-detected from your endpoint (LM Studio, OpenRouter, …) with a Detect button and manual override — conversation history now fills the model's real context instead of a fixed character cap, and an over-limit warning flags a value set above the detected maximum.
  - **Portrait / mobile layout** — a single-panel responsive mode alongside the three-panel desktop view.
  - **Lore Dictionary** — a keyword-triggered world-info editor; matching keywords inject lore into the AI prompt.
  - **Full per-turn AI context viewer** — see exactly what's sent to the AI on each turn, plus the raw response before sanitation — useful both for debugging and for authoring/tuning worlds.
- **🛠️ Developer tooling**
  - **Automated test suite** built from scratch (Vitest + Testing Library) covering the new libraries, services, and components, plus a coverage script (`npm run coverage`).
  - **GitHub Actions CI** — typecheck, lint, and tests run on every push and pull request.
  - **Optional VRAM monitor** — a local helper (`npm run vram-helper`) and in-app readout that warns before loading TTS would exhaust GPU memory.
  - Project scaffolding: `.env.example`, `.nvmrc`, and a rewritten README.
  - This wiki, published automatically from `docs/` by a GitHub Action.
- **⚙️ Backend / invisible**
  - **Full JavaScript → TypeScript conversion** of the entire codebase (10 phases), finishing on **strict** mode with shared domain types under `src/types`.
  - **World & save versioning** — an `APP_VERSION` derived from `package.json`, idempotent import migration (`migrateWorld`) that upgrades legacy worlds at every import boundary, presence-based save-envelope detection, and version stamps on saves, exports, and the bundled worlds. (See the [World Format](WorldFormat) versioning notes.)
  - Heavy save conversion and serialization moved to **web workers** so the UI never freezes on large files.
  - Reusable utilities extracted: world import/catalog, output length, AI-response parsing, tag/dictionary/highlight helpers, and a thumbnail cache.

#### ➖ Removed

- **👤 User-facing**
  - The fullscreen menu popup, replaced by the redesigned world browser.
  - The previous bundled example worlds (`slime`, `sugarscape`, `veilwood`), swapped for the current set.
- **🛠️ Developer tooling**
  - In-repo planning notes and server stubs under `src/docs/` (publish-feature plan, server README, tags-implementation notes, server-worlds stub).
- **⚙️ Backend / invisible**
  - All legacy `.jsx` / `.js` sources, superseded by `.tsx` / `.ts` equivalents (views, contexts, workers, prompts, db & utils, UI primitives).
  - `jsconfig.json` (replaced by `tsconfig.json`) and a stray `Idle.fbx` animation file.

#### 🐛 Fixed

- **👤 User-facing**
  - Custom VRM models exported from v1.2 were **silently stripped on import** — now migrated and preserved.
  - Body-morph sliders now resize clothing meshes instead of clipping through them.
  - VRM outline color rendering issue.
  - AI response parsing errors that could break choices and stat updates.
  - The Settings panel no longer jumps vertically when its contents change.
  - Unsaved world edits are detected on exit, with a confirmation prompt to prevent data loss.
- **⚙️ Backend / invisible**
  - Server-Sent Events streaming now handles chunk boundaries correctly — no dropped or garbled tokens mid-stream.
  - Removed side effects from the `setPlayerStats` state updater.
  - The recent-stat-change highlight timer is cleared properly, and streaming guards against a missing `response.body`.

### Minor Changes

#### ➕ Added

- **👤 User-facing**
  - **Markdown formatting** toggle (Settings → Gameplay, default off) — when on, the narration prompt asks the AI to format with bold/italics, lists, and tables (e.g. inventory) using a floor-based rule (one bold + at least one italic per turn) that small models follow reliably; off keeps plain prose. (Reset Prompts to pick it up if you've customized the system prompt.)
  - **Hide stat numbers from the narrator** (Settings → Gameplay, default on) — the narration, planning, and choices requests receive stat *descriptors* (e.g. "severely injured") instead of raw values, so the model writes to how a stat *feels* rather than fixating on the number. Stat-updates still get the numbers; falls back to the number when a stat has no descriptor.
  - **Slash commands** in the action box (input starting with `/`) that bypass the AI; the first, `/markdown test`, types a rich sample through the real narration renderer to preview markdown formatting.
  - **Use Custom Endpoint** toggle in Settings → Endpoint — off uses the built-in default endpoint (fields read-only); on lets you enter and edit your own. Custom values are preserved when toggling off and back on.
  - Drag-to-reorder for worlds in the main menu.
  - Additional avatar color options.
  - Unified, consistently styled scroll areas across the app.
  - Tag truncation and a centered download control in the world browser.
  - LLM request status surfaced next to the status bar.
- **⚙️ Backend / invisible**
  - Shared hooks and helpers: a `createWorkerClient` worker factory, a single IndexedDB open/promisify helper (`idb`), `usePersistentState`, `useIsMobile`, and a cached-thumbnail hook.

#### ➖ Removed

- **⚙️ Backend / invisible**
  - Dead code and noisy logging, including a leftover `bufferToSentence` helper and an auth-token console log.

#### 🐛 Fixed

- **👤 User-facing**
  - Mislabeled UI text and icons corrected.
  - The memory meter is now an accurate **token** gauge of the model's context window — prompt + (actually-sent) history + reserved output as a % of the window — fixing the old bar that mixed characters and tokens and counted the full untrimmed log.
- **⚙️ Backend / invisible**
  - Entity IDs now use `crypto.randomUUID()` instead of timestamp-based IDs, avoiding collisions.
  - Lint cleanups across the converted codebase.
