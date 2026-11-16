# 03: Enable Character Mentions

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The first slice the player sees. The player turns Character Mentions on, the model downloads, and each finished narration passage gets a Mention Reading on its turn.

- **Coref Model Store:**
  - It reads the R2 manifest (format from ticket 01).
  - It downloads and caches the chosen model's files, verifies their size and hash, and reports progress.
  - It downloads a new manifest version in the background and replaces the old one only after the new one verifies.
  - Turning the feature off deletes the cached files.
  - It follows the semantic-memory download pattern.
- **Settings:**
  - An on/off toggle, off by default, that shows the download size. Defaults go in the settings defaults module.
  - A progress bar in MB, and an error row with retry.
  - A model choice: Auto, Big or Small.
  - When AI Language is not English, the toggle is disabled with a short reason.
- **Model choice:** on enable, Auto picks the big model only when a WebGPU adapter exists and a 300-token probe runs under 300 ms. The result is stored per device. The probe runs again when the player picks Auto again or the big model's manifest version changes.
- **The reading on the turn:**
  - After a passage finishes, the host and the Mention Reading run as background work that no turn waits for. The reading is stored on the turn.
  - This ticket owns that shape; tickets 04, 06 and 07 only read it.
  - When the feature is off, still loading, or failed, turns are exactly as today.
- **Dev view:** a dev-only view of the turn's reading (dev router or AI context panel) for verification.
- **Credits:** add LitBank (CC BY 4.0).
- **R2:** the bucket is the user's setup step. Use a local manifest in dev until the bucket exists.
- **Changelog:** a fragment for the feature.

## Acceptance criteria

- [x] Turning the toggle on downloads, verifies and caches the files, and progress shows in MB. A hash mismatch shows the error row. `characterMentions.test.ts` (download with byte progress, files split into cache parts and read back intact; hash mismatch → error and nothing cached; Retry recovers) and `CharacterMentionsRows.test.tsx` (MB row, error row). Live in the browser pane: the local manifest's big model (496 MB) downloaded, verified and loaded on WebGPU.
- [x] Turning it off deletes the cached files. `characterMentions.test.ts` "deletes the cached files…" and "finishes a delete an earlier session left undone"; live: the cache held 0 entries after the toggle went off.
- [x] The probe picks Big on WebGPU under the limit and Small otherwise, and the override beats it. Tests use a faked adapter and timing. `characterMentions.test.ts` "model choice" (5 tests: under/over the limit, no adapter, override both ways, per-device verdict with reruns on a new big version and a fresh Auto pick). The probe passage is 300 model tokens; live on an RTX 4090 the probe passed.
- [x] A non-English AI Language disables the toggle, and nothing downloads. `CharacterMentionsRows.test.tsx` (disabled, reason shown, no size fetch) and `characterMentions.test.ts` "downloads nothing while AI Language is not English" (no request made).
- [x] A finished passage gets a reading on its turn, and a new turn never waits for it. `useTurnMentionReadings.test.tsx` (reading stored once the passage finishes; the next turn runs while a reading is unanswered and both turns get one; a regenerate drops the stale result). Live: the `whiteRoom` fixture's newest turn got a big-model reading, shown at `#dev?view=gameViewer&fixture=whiteRoom&modal=mentionReading`.
- [x] A turn with the feature off is byte-equal to today's turn result. By construction: readings live in a side map on the save envelope and never touch the history or the turn pipeline. `GameplayContext.mentionReadings.test.tsx` shows a save without readings has no `mentionReadings` field.
- [x] Frames: `.scratch/frames/settings-off.png`, `settings-downloading.png` and `settings-on.png`, light and dark, at desktop and mobile width. Taken with Playwright on the worktree dev server; 12 files named `settings-<state>-<theme>-<width>.png`.

For you: create the public R2 bucket on a custom domain, and upload the first manifest and weights.
For you: play a few turns with the feature on, and check that narration never stalls.

## Notes

- **Storage (Q42):** `SaveObject.mentionReadings` maps turn id → `{ model, version, textHash, reading }`. Readings are stored, not recomputed: a reading costs 50 ms to 1.4 s per passage, a stored one is a few hundred bytes. `turnMentionReading(map, turnId, narration)` is the read helper for tickets 04, 06 and 07; it returns null when the narration changed since the reading.
- **Which turns get read:** the newest settled turn, plus any turn that had a reading and whose narration changed (edit or regenerate). Older turns are never backfilled. One reading runs at a time.
- **Cache parts:** Chromium refuses one CacheStorage entry near 370 MB (tested: 200 MB stores, 370 MB fails, streamed or not), so each file is cached as parts of at most 64 MB.
- **Updates:** a failed update or no network keeps the cached model reading; the error row shows only when no model is usable.
- **Dev manifest:** the dev server serves `.scratch/coref/publish` at `/coref-dev/` (`testing/coref/README.md`). The current dev manifest holds `small-litbank` and `big-e120` as version 1.

## Landed

**Not verified**

- Narration from a real AI turn with cast mentions was not read live; the live reading ran on the `whiteRoom` fixture, whose newest turn names no cast member.
- The probe's fail path and the WASM path ran only in tests and in headless Chromium (no WebGPU → Small). Integrated GPUs, Firefox, Safari and Android WebView are not checked.
- Opening the cached big model at app start took more than 6 s in the browser pane (reading 496 MB from the cache and loading it onto the GPU). Nothing waits for it, but it holds that memory from the main menu on.

**For you**

- Create the public R2 bucket on a custom domain, and upload the first manifest and weights.
- Play a few turns with the feature on, and check that narration never stalls.
- Look at the Settings frames: `.scratch/character-mentions-03/frames/settings-<off|downloading|on>-<light|dark>-<desktop|mobile>.png`.
- `VITE_COREF_MANIFEST_URL` is a new optional `.env.local` variable; leave it unset to use the published manifest.
