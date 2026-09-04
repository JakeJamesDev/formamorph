# Segmented Model Download

Status: ready-for-agent

## Problem Statement

Model downloads run far below the player's line speed. A player on a 35 MB/s connection watches a 2.8 GB model arrive at ~8 MB/s; a fiber player would see the same ceiling. Measurement (2026-08-27, from the dev machine) pinned the cause: Hugging Face's CDN caps a single connection at ~10-13 MB/s, while three parallel range requests to the same file aggregated ~27 MB/s. The app downloads over exactly one connection, so it inherits the per-connection cap plus a small streaming overhead. First-run setup — the player's first minutes with the product — takes several times longer than their connection allows.

## Solution

Download models over several parallel range requests into one preallocated file, with the number of connections adapting to whatever the player's line and the CDN actually pay out. A 35 MB/s line saturates at three or four connections; a 100+ MB/s fiber line ramps higher, up to a hard ceiling. Progress, pause, resume across restarts, and the setup gate's UI all behave exactly as they do today — only faster.

## User Stories

1. As a first-time player, I want the model download to use my full connection speed, so that setup takes minutes instead of most of an hour.
2. As a player on a fast fiber line, I want the downloader to open more connections than a slower player needs, so that my hardware advantage actually shows.
3. As a player on a modest line, I want the downloader to stop adding connections once my line is saturated, so that no bandwidth is wasted on overhead.
4. As a player, I want the progress bar and toast to behave exactly as they do now, so that the speedup changes nothing I have to relearn.
5. As a player, I want to pause a download and resume later — including after closing the app — so that a large file never has to restart from zero.
6. As a player who started a download on the old single-stream version, I want my existing partial file to count, so that updating the app does not throw away downloaded gigabytes.
7. As a player whose download errors partway, I want the completed portions kept, so that retrying only fetches what is missing.
8. As a player, I want a downloaded file that reports complete to actually be complete, so that a truncated file never poses as a valid model.
9. As a player behind a CDN that rejects parallel connections, I want the downloader to back off and continue more slowly, so that the download still finishes.
10. As a player whose server ignores range requests, I want the downloader to fall back to today's single-stream behavior, so that nothing that works today breaks.
11. As a player with the models folder on a spinning disk, I want chunk writes to stay largely sequential, so that parallelism does not thrash the drive.
12. As a player, I want the app to stay responsive during a fast download, so that browsing worlds while downloading remains pleasant.
13. As the developer, I want no user-facing tuning knob, so that the right connection count is found automatically instead of asked about.
14. As the developer, I want the parallel client to behave politely toward Hugging Face, so that the app never looks like an abusive scraper.
15. As the developer, I want the planning, resume, and ramp logic as pure functions, so that the concurrency policy is testable without any network.

## Implementation Decisions

- All changes live in the desktop (Electron main) download layer. The renderer, the setup gate, the toast handoff, and the progress event shape (`fileName`, `received`, `total`, `done`) are untouched.
- **Chunk queue, not fixed splits.** The file is divided into ~64 MB chunks forming a work queue. A pool of K workers each pull a chunk, issue a range request for it, and write it at its offset. Fast workers naturally take more chunks; the queue drains fully, so there is no idle-tail problem near the end.
- **Single preallocated part file.** The temp file is preallocated at full size and written with positioned writes on one file descriptor. Success renames it to the final name, exactly as today; a cancelled or failed download leaves it in place.
- **Sidecar resume state.** A JSON sidecar beside the part file records the server-reported total and the chunk bitmap. Resume re-queues unfinished chunks. The sidecar is deleted on success. A sidecar whose total disagrees with the server's current total means a stale partial: discard and restart (this replaces the single-stream 416 recovery, which the fallback path keeps).
- **Legacy partial migration.** A part file with no sidecar is the old contiguous format: its length marks a prefix of whole chunks as done; the remainder re-queues. Updating the app never discards downloaded bytes.
- **Adaptive worker count.** Start at K=3. Measure aggregate throughput over a rolling window of a few seconds; while adding a worker still grows aggregate meaningfully (on the order of 15%), add one. Hard ceiling K=8. On 429/503 or repeated segment errors, halve the pool and stop ramping. No settings knob anywhere.
- **Fallback.** A 200 response to a range request (server ignores ranges) degrades to the current single-stream append path unchanged.
- **Kept guards:** the Hugging-Face-only host allowlist, one-download-at-a-time, pause-as-abort preserving the partial, and unconditional engine auto-load on completion.
- **Progress throttling.** Aggregated progress (bitmap plus in-flight bytes) is emitted at a few events per second instead of per network chunk. This also fixes the pre-existing per-chunk IPC flood, which re-rendered the gate up to hundreds of times per second.
- Completion requires the bitmap full and byte totals matching; the rename never happens off a partial write.
- Measurement basis (2026-08-27): curl single-stream to HF ~12.7 MB/s; Electron fetch bare ~10.7 MB/s; through the real pump to disk ~8.2 MB/s; three parallel streams ~27 MB/s aggregate; a non-HF control mirror did 18 MB/s single-stream. Expected result: ~3-4 workers saturate a 35 MB/s line; the ceiling supports roughly 90-100 MB/s where the line allows.

## Testing Decisions

- Tests assert external behavior: bytes on disk, files renamed, events emitted, requests made — never internal worker scheduling.
- Seam 1: the pure functions — chunk planner (size → queue), bitmap/resume logic (bitmap or legacy part length → remaining queue), ramp controller (throughput samples → K) — tested directly in the existing Electron-layer vitest arrangement.
  - Planner: exact cover of the file, no overlap, last-chunk remainder handled.
  - Resume: round-trips through interrupt states; legacy prefix mapping; stale-total discard.
  - Ramp: grows on improving samples, stops at plateau, halves on error signals, respects the ceiling.
- Seam 2: the download orchestrator end-to-end against a local mock HTTP server that serves range requests, with fetch injected and a real temp-directory filesystem. Cases: parallel ranges requested and assembled byte-identically; interrupt then resume fetches only missing chunks; 200-response fallback to single stream; 429 back-off; rename only on completion; abort preserves part and sidecar.
- Prior art: the existing Electron-layer test files, including the stream pump's own tests and the model scan/move tests that exercise a real temp filesystem.
- Guards must bite: each guard is checked by reinstating its bug (for example, skipping the total-match check, or letting a 200 response run the segmented path) and watching the test fail.
- Before release: re-run the throwaway Electron throughput probe with the pool enabled to confirm the aggregate on a real HF URL roughly matches the curl prediction. Network-dependent, so it stays outside the gates.

## Out of Scope

- Any renderer, gate, or toast changes beyond what the unchanged progress event already drives.
- Download rate display in the UI.
- Parallelism for the app-update zip downloader (same pump, different caller); it can adopt the mechanism later.
- A user-facing connections setting.
- Mirror selection, alternative hosts, or widening the Hugging Face allowlist.
- Checksum verification of downloaded files (not present today; a separate decision).
- Changes to engine auto-load, model scanning, or the models-folder picker.

## Further Notes

- The per-connection cap is a CDN property that varies by region and time; the adaptive ramp is the design's answer to that variance, so hardcoded throughput numbers above are calibration context, not contracts.
- `hf_transfer` and aria2 use the same parallel-range pattern against this CDN, so the approach is sanctioned client behavior; the K=8 ceiling and error back-off keep it polite.
- Positioned parallel writes are cheap on SSDs; the 64 MB chunk size keeps writes largely sequential for spinning disks. Worth a manual check on an HDD if one is available, not a design change.
- The diagnosis session (2026-08-27) that produced the measurements is summarized in the spec's Problem Statement; the probe script was throwaway.
