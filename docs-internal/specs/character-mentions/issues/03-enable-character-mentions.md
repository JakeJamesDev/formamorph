# 03: Enable Character Mentions

Status: ready-for-agent
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

- [ ] Turning the toggle on downloads, verifies and caches the files, and progress shows in MB. A hash mismatch shows the error row.
- [ ] Turning it off deletes the cached files.
- [ ] The probe picks Big on WebGPU under the limit and Small otherwise, and the override beats it. Tests use a faked adapter and timing.
- [ ] A non-English AI Language disables the toggle, and nothing downloads.
- [ ] A finished passage gets a reading on its turn, and a new turn never waits for it.
- [ ] A turn with the feature off is byte-equal to today's turn result.
- [ ] Frames: `.scratch/frames/settings-off.png`, `settings-downloading.png` and `settings-on.png`, light and dark, at desktop and mobile width.

For you: create the public R2 bucket on a custom domain, and upload the first manifest and weights.
For you: play a few turns with the feature on, and check that narration never stalls.
