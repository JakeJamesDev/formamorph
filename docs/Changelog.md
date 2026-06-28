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
  - **Standalone Windows app** — run Formamorph as a desktop `.exe` (Electron) with no browser needed. It bundles its own engine, so WebGPU TTS, 3D rendering, and saved-world storage all work the same as in-browser.
  - **Custom 3D avatars** — bring your own `.vrm`, or set a per-world custom player model.
  - **In-app media player** — a fully themed audio widget for TTS narration, with auto-generated TTS when the model is loaded and a one-click unload of the TTS model to free VRAM.
  - **Redesigned world browser ("Discover")** — card-grid layout, tag & author chip search/filtering, and world-preview image zoom.
  - **AI output controls** — automatic paragraph limits and length-based truncation, an optional "thinking / planning" step before the reply, and a smoothed character-by-character reveal of streamed text.
  - **Re-generate & rollback** — page back through the turn history to re-generate the latest AI response, or roll back to an earlier turn (discarding the turns after it). The per-turn AI-context viewer flags the regenerated and rolled-back turns.
  - **Markdown narration** — the AI can format story text with bold/italic, bullet & numbered lists, tables (e.g. inventory), headings, blockquotes, and code; it renders live as the text streams in.
  - **Token-based Context Window**, auto-detected from your endpoint (LM Studio, OpenRouter, …) with a Detect button and manual override — conversation history now fills the model's real context instead of a fixed character cap, and an over-limit warning flags a value set above the detected maximum.
  - **Portrait / mobile layout** — a single-panel responsive mode alongside the three-panel desktop view.
  - **Lore Dictionary** — a keyword-triggered world-info editor; matching keywords inject lore into the AI prompt.
  - **Full per-turn AI context viewer** — see exactly what's sent to the AI on each turn, plus the raw response before sanitation — useful both for debugging and for authoring/tuning worlds.
  - **Stat-driven body sliders** — in the world editor, bind any stat to one or more of the model's body morph sliders; the stat's value (min→max) drives the morph live in-game. Legacy weight/breasts/stomach stats are auto-bound on import, so existing worlds keep working.
- **🛠️ Developer tooling**
  - **Automated test suite** built from scratch (Vitest + Testing Library) covering the new libraries, services, and components, plus a coverage script (`npm run coverage`).
  - **GitHub Actions CI** — typecheck, lint, and tests run on every push and pull request.
  - **Optional VRAM monitor** — a local helper (`npm run vram-helper`) and in-app readout that warns before loading TTS would exhaust GPU memory.
  - **Desktop packaging** — a thin Electron shell (`electron/`) plus electron-builder config; `npm run desktop:build` produces a portable Windows exe from the same web build.
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
  - **Hide-UI toggle** — an eye button in the bottom-left of the game view hides all panels to reveal the background image; it fades out over the background until hovered.
  - Drag-to-reorder for worlds in the main menu.
  - Additional avatar color options.
  - Unified, consistently styled scroll areas, checkboxes, radios, and chips across the app.
  - Tag truncation and a centered download control in the world browser.
  - LLM request status surfaced next to the status bar.
  - **Update-aware world browser** — downloaded worlds show their status (Downloaded / Update available / out of date) with one-click re-download to pull the latest version.
  - **World provenance on cards** — local world cards show how each world arrived (Created / Downloaded / Imported) with timestamps.
  - **Main-menu layout toggle** — switch the world grid between Grid and Detailed layouts.
  - **Markdown in world descriptions** — world descriptions render markdown, matching the in-game narration.
  - **In-game entity viewer** — the avatar panel gained Player / Entities tabs; the Entities view shows the first detected entity's image, clicking an entity in the list swaps to it, and clicking the image opens a full zoom view (works even for worlds without a player model).
  - **Entity popup** — viewing an entity now supports the same pan/zoom image view as world thumbnails, sizes the image to most of the popup with its description below, and shows a muted "No description provided." when there's no text.
  - **AI-context "current context only" filter** — the per-turn context viewer can hide re-generated, rolled-back, and aborted turns so you see only what the AI currently sees (on by default).
  - **Per-prompt System Prompt editor** — Settings → Prompts has a tab per prompt type (Game Text, Thinking, Choices, Stat Updates, Location Change), and Reset affects only the selected prompt.
  - **Full-length, progressive TTS narration** — narration is split into sentence chunks so audio is no longer cut off at ~26 s (Kokoro's per-call token cap). Playback is progressive: speech starts after the first sentence and plays gaplessly (Web Audio) as the rest generate, with a determinate progress bar (sentence X of N); the seek bar is driven by the same engine, so the clip is scrubbable/replayable with no hand-off.
  - **Stream Narration Audio** (Settings → Gameplay, default off) — when on, text-to-speech begins synthesizing each sentence the moment it finishes streaming from the model, instead of waiting for the whole story; much lower audio latency. Off by default since TTS then runs alongside the model and can compete for the GPU on a single-machine setup.
- **⚙️ Backend / invisible**
  - Shared hooks and helpers: a `createWorkerClient` worker factory, a single IndexedDB open/promisify helper (`idb`), `usePersistentState`, `useIsMobile`, and a cached-thumbnail hook.
  - The Discover world-browser was split out of `MainMenu` into its own `DiscoverWorlds` view, with shared world-card/detail presentation helpers (`WorldDetails`).
  - **Per-turn memory digests (foundation)** — each turn now carries a stable `turnId` and a lazily-generated, persisted `summary` of typed fact lines, produced by a silent request as soon as each turn completes (opt-in via Settings → Gameplay → Memory Digests; prompt editable under System Prompts → Summary). With "Show Silent Requests" on, each digest is inspectable per turn in the AI-context viewer. Nothing consumes them yet — this is groundwork for keeping long stories coherent without bloating each request.

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
