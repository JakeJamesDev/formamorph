# External Model Location — Design

**Status:** ✅ Implemented (`electron/modelScan.cjs`, `main.cjs`, `LocalModelModal.tsx`)
**Scope:** Desktop (Electron) only. Web build unaffected.

## Goal

Users already have GGUFs downloaded for other apps (LM Studio, Ollama, koboldcpp) and don't want
to duplicate multi-GB files. Keep the root `models/` folder exactly where it is, and add **one**
configurable external search location, with a checkbox to also search its subfolders (LM Studio
nests models as `publisher/repo/file.gguf`).

## Decisions (interviewed 2026-08-01)

| Question | Decision |
|---|---|
| How many extra locations | **One** external folder (extend to a list later if asked) |
| Config UI lives | **Local Models modal → Options tab** (a third tab beside Installed and Recommended; first shipped as a section on the Installed tab, moved once it grew a download-folder section too) |
| External model operations | **Load only — read-only.** No delete button on external models; downloads, partials, and deletes stay root-only |
| LM Studio quick-pick | ✅ One-click button fills in the detected LM Studio models path |
| Origin visibility | ✅ External models show their subpath/badge in the Installed list |
| Subfolder checkbox default | ✅ **On** when a folder is set (LM Studio is the main use case) |

## Model identity

Today a model's identity is its bare filename everywhere: the `llm-load` IPC, the drag-order key,
and the served OpenAI model id. That stays true for root models (no migration, saved order keys and
endpoint model ids keep working). External models get a qualified ref:

- **List entries** become `{ id, fileName, size, source: 'root' | 'external', subpath }`.
  Root: `id = fileName`, `subpath = ''`. External: `id = 'ext:' + <relative path>` with forward
  slashes, `subpath` = the containing folder relative to the external root (`bartowski/X-GGUF`).
- **Load IPC** accepts the `id` string directly (simpler than the `{ source, relPath }` pair first
  sketched, and backward-compatible for free since a root id *is* the old bare filename). Main
  resolves it against the matching base dir and rejects anything that escapes it (see Security).
- **Served model id is unchanged** — the engine derives it from the file basename, so the endpoint
  model setting and auto-reload flows never see the new ref shape.
- **Filename collisions** (same GGUF name in both roots): both rows are listed; the subpath badge
  disambiguates. No dedupe — the refs are distinct, so load is never ambiguous.

## Main process (electron/main.cjs + new module)

**Persisted setting** — main-process side, because path confinement is enforced in main and the
scan must work before the renderer hydrates:

```json
// <userData>/model-locations.json
{ "externalDir": "C:\\Users\\benny\\.lmstudio\\models", "searchSubfolders": true }
```

`userData` is already redirected for portable builds, so the setting travels with a portable root.
`externalDir: null` = feature unset.

**New/changed IPC:**

| Channel | Change |
|---|---|
| `llm-get-locations` | new — returns `{ rootDir, externalDir, searchSubfolders }` |
| `llm-set-locations` | new — validates the dir exists, persists, returns the updated value |
| `llm-pick-folder` | new — native `dialog.showOpenDialog({ properties: ['openDirectory'] })` |
| `llm-detect-lmstudio` | new — probes `~/.lmstudio/models` (verified present on the dev machine), then the legacy `~/.cache/lm-studio/models`; returns the first hit or null |
| `llm-list-models` / `llm-list-installed` | scan root (flat, unchanged) **plus** external (flat, or recursive when `searchSubfolders`); return the qualified entry shape |
| `llm-load` | accepts `{ source, relPath }`; root also accepts a legacy bare-filename string |
| `llm-download*`, `llm-*-partial`, `llm-delete-model` | unchanged — root-only by design |

**Scan rules** (extracted to `electron/modelScan.cjs` so it's unit-testable like `corsShim`):

- `.gguf` suffix, case-insensitive (naturally excludes `.part` / LM Studio partials).
- Recursion capped at depth 6; symlinked directories are not followed (cycle/escape guard).
- Files whose resolved path falls inside the root models dir are skipped during the external scan
  (guards external-set-to-parent double-listing); external == root is rejected at set time.
- Missing/unreadable external dir → scans as empty, non-fatal; the UI shows an inline warning.
  The setting is kept (a temporarily unmounted drive shouldn't wipe config).

**Security stance preserved:** no arbitrary-path load is exposed. `llm-load` resolves `relPath`
against the chosen base, normalizes, and verifies the result is still inside that base (rejects
`..` traversal); only the two configured bases are ever valid.

## Renderer (LocalModelModal, Installed tab)

**"Search Locations" section** (collapsible row group above the model list):

- Root folder: path shown read-only (existing `modelsDir()` value).
- External folder: path display + **Browse** (native picker) + **LM Studio** quick-pick (shown
  only when detection hits; fills the path) + clear (✕).
- **Include Subfolders** checkbox — defaults checked when a folder is first set; disabled/hidden
  while no folder is set.
- Inline warning row when the configured folder is currently missing.

**Model rows:**

- External rows show a muted subpath badge (`bartowski/Model-GGUF`) and **no delete button**;
  load, reorder, and the loaded-state highlight work identically.
- Drag-order localStorage key stores `id`s — existing saved orders are root filenames, which are
  unchanged ids, so old orders survive with no migration.

**Edge behaviors:**

- Clearing the folder while an external model is loaded: the engine keeps running (it holds an
  absolute path); the row simply disappears from the list. Next load must pick a listed model.
- The Recommended tab and its downloads are untouched — downloads always land in root.

## Out of scope (this slice)

- Multiple external locations (list UI) — extend `externalDir` to an array later if requested.
- Watching the external folder for changes (list refreshes on modal open, as today).
- Non-GGUF assets (mmproj, draft models) — same filter as today.

## Notes from the build

- The **Recommended tab stays root-scoped**: a catalog model is "Installed" there only when it's in
  our own folder, since that tab's Load/Delete work on root refs and downloads land in root. The same
  file found externally still appears (and loads) on the Installed tab.
- **Auto-start prefers a root model** (`LocalEngineManager`) so an external library is a bonus rather
  than something that changes which model boots for existing users.
- The **served OpenAI model id is still the file's basename**, unchanged by any of this.

---

# Part 2 — Configurable Download Folder

**Status:** ✅ Implemented (`electron/modelMove.cjs`, `main.cjs`, `LocalModelModal.tsx`)

## Goal

The folder we download into is fixed beside the app. Users with a small system drive want models on
another disk. Make the **download folder** configurable, defaulting to today's `<appBase>/models`.

## Decisions (interviewed 2026-08-01)

| Question | Decision |
|---|---|
| Existing models on change | **Offer to move them** to the new folder |
| Declining / partially failing the move | **Old folder drops out of the searched set regardless**; the result dialog names what was left behind and where |
| Ownership (delete, partials) | **Any folder we download to is ours** — delete stays enabled there; partials live beside their target. The external search folder stays read-only |
| Download folder unavailable | **Refuse with a clear message** + a button to pick a new folder. Never silently redirect |
| Disk space | ✅ Show free space on the chosen folder · ✅ Warn before a download that won't fit |

## The searched set, restated

Two folders, same as Part 1 — only the first one moves now:

1. **Download folder** (`downloadDir`, default `<appBase>/models`) — flat scan, **ours**: downloads
   land here, partials live here, delete is enabled. This is what Part 1 called "root", and model
   refs here stay bare filenames, so nothing about ids or saved orderings changes.
2. **External folder** (`externalDir`) — read-only, unchanged from Part 1.

Changing `downloadDir` **replaces** entry 1. The previous folder is not retained (the user's call),
so the move dialog is the only thing standing between a folder change and models leaving the list —
which is why its report has to name what it left behind.

## Move-on-change

Triggered when `downloadDir` changes **and** the old folder holds at least one `.gguf` or `.part`.
`.part` files move too, so a paused download stays resumable.

**Prompt:** "Move 3 models (14.2 GB) to the new folder? — Move / Leave them". The dialog states
plainly that models left behind will no longer appear in the list.

**Mechanics** (`electron/modelMove.cjs`, new, testable):

- Same volume → `fs.renameSync`, effectively instant.
- Cross volume → `rename` throws `EXDEV`; fall back to a streamed copy to `<target>.moving`, `fsync`,
  rename into place, then unlink the source. A cancel or crash leaves the source intact and only a
  `.moving` temp to clean, never a half-file that looks like a model.
- **Per-file progress** streamed to the renderer (`llm-move-progress`), with a **Cancel** button.
- Failures (locked file, out of space) are **skipped, not fatal**: the run continues and reports them.
- Free space on the target is checked against the whole batch up front; short → say so before starting.

**The loaded model:** unload → move → reload from the new path, so the user ends where they started.
If its move fails, reload from the *old* path so the engine isn't left stopped by a failed migration.

**Result dialog:** "Moved 2 of 3. Left in `D:\old\models`: `foo.gguf` (in use by another program)."
Since the old folder is no longer searched, this dialog is the only record — it stays open until
dismissed and offers **Copy paths**.

## Disk space

`fs.statfsSync(dir)` → `bavail * bsize`. Verified available: Electron 42.5.0 bundles Node 24.17.0
(read from the installed binary; `statfsSync` landed in Node 18.15).

- Search Locations shows `412 GB free` beside the download folder.
- Before a catalog download, compare `sizeBytes - alreadyReceived` against free space and warn
  ("Needs 8.1 GB, 3.2 GB free") with a proceed-anyway option — a warning, not a block, since the
  number can be stale on a network share.

## IPC delta

| Channel | Change |
|---|---|
| `llm-get-locations` | + `downloadDir`, `downloadDirMissing`, `freeBytes` |
| `llm-set-locations` | accepts `downloadDir`; validates it's a writable directory before persisting |
| `llm-move-models` | new — `{ from, to }`, streams progress, resolves `{ moved[], skipped[{file, reason}] }` |
| `llm-move-cancel` | new — stop after the current file |
| `llm-count-movable` | new — `{ count, bytes }` for the prompt, so the renderer doesn't guess |
| `llm-download` | refuses when `downloadDir` is missing, with a message naming the folder |

`model-locations.json` gains `downloadDir` (null = the built-in default, so an untouched install
keeps working if the app base path ever moves).

## Risks

- **Portable builds**: an absolute `downloadDir` on a different drive defeats "copy the folder and
  everything comes with it". Storing `null` for the default preserves that for anyone who never
  changes it; anyone who does has opted out knowingly. Worth a line in the picker.
- **The move is the risky part of this feature** — it's the only code path that deletes a user's
  multi-GB file. Copy-then-verify-then-unlink, never `unlink` before the target is `fsync`ed.

## Notes from the build

- **`downloadDir: null` means "the built-in default"** rather than storing the resolved path, so a
  portable install that never changes it keeps resolving relative to wherever the folder was copied.
- **`llm-set-locations` patches only the keys present in `opts`**, so the UI can change the download
  folder without restating the external one. It also `access(W_OK)`-checks a chosen download folder —
  a read-only pick would otherwise fail at the least recoverable moment, mid-download.
- **A name collision at the destination is a skip, not an overwrite.** Neither file is touched, and
  the result panel reports it like any other skip.
- **The move's temp suffix is `.moving`, deliberately not `.part`** — `.part` means "a resumable
  download" to `modelDownload`, and a half-copied model must never be mistaken for one.
- The mover **carries `.gguf.part` files too**, so changing folders doesn't strand a paused download.

## Ship checklist

- [x] `modelMove.cjs` unit tests (15): same-volume rename, cross-volume copy+unlink, EXDEV fallback, cancel mid-batch leaves source intact, skip-on-failure continues, `.part` files carried over, destination-collision skip, byte-for-byte content check
- [x] Guards mutation-checked — unlink-before-copy, collision check, and cancel accounting each fail their test when removed
- [x] Four gates green + `graphify update .`
- [x] Changelog In-Progress 👤 entry
- [x] No world/save export-shape change

---

## Ship checklist (Part 1)

- [x] `modelScan.cjs` unit tests: suffix filter, depth cap, symlink skip, traversal rejection, root-overlap skip
- [x] Guards mutation-checked — traversal, root-overlap, and depth-cap tests each fail when the guard is removed
- [x] Four gates green + `graphify update .`
- [x] Changelog In-Progress 👤 entry
- [x] `docs/` has no page documenting the models folder — nothing to update
- [x] No world/save export-shape change (new persisted file is desktop-local config: `model-locations.json`)
