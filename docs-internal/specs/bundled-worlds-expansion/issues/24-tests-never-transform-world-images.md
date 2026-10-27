# 24: Tests Never Transform World Images

Status: done
Blocked by: 23
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q22; Testing Decisions)

## What to build

Ticket 23 stopped the seeder's copy of the bundled worlds from carrying images under vitest, but a test file's own `?raw` import still does. Vite transforms those imports in the main vitest process, so every per-world and bundled-suite test file makes the main process hold a lossless world as a module string. With Sugarscape's art landed the source totals about 238 MB and the main process dies at the default 4 GB heap during ticket 14's prepare, while every test file reports green. The user ruled for the clean fix, not a heap flag.

- Under vitest, no module receives a bundled world's `data:` URIs through Vite's transform. The strip plugin from ticket 23 treats a test file like any other importer; its test-file exemption goes.
- A test that needs the real bytes reads the file from disk inside its worker, the way the shipped-world and bundled-fingerprint tests already do. The known sites: the shared suite's Test Bench rule pass, since `image-not-webp` and `image-mislabeled` must keep seeing real images, and the stripped-seed guard's assertion that the source holds images. Audit the other `?raw` sites; a per-world test reads ids, rules, scripts and text, and the stripped copy serves it. One helper owns the disk read if more than two tests need it.
- The main-process heap stays within the default limit on the full suite at today's source size. Measure the main process and the largest worker before and after with ticket 23's sampling method, on the same source, and put the numbers in this ticket's comments beside ticket 23's table.
- No `--max-old-space-size` returns anywhere; ticket 23's criterion stays true.

## Acceptance criteria

- [x] A test proves a test file's own `?raw` import of a bundled world arrives stripped, and goes red with the plugin's test-file exemption restored. Stripped-seed test "strips a test file's own `?raw` import of a bundled world too"; red with the exemption back, twice (before and after the review's refactor).
- [x] The shared suite's Test Bench pass runs on real image bytes: a mutation that inserts a non-WebP image into a disk-read world makes `image-not-webp` fire in the suite. A 1×1 PNG in place of Valentines' first WebP fails "raises no Test Bench finding beyond its open list" with `image-not-webp: Hana Sakuragi`.
- [x] The full suite is green with the default heap in the main process and the workers. Main-process and largest-worker peak heap, before and after, are in the comments. The after run's one red was the test-selection list missing the new helper, fixed and rerun green; prepare's full gates confirm.
- [ ] Ticket 14's prepare gate passes on a rebase over this landing, reported by ticket 14.
- [x] No changelog fragment; the change is test-only.

## Landed

**Not verified**
- Ticket 14's prepare on a rebase over this landing: ticket 14 reports it.

**For you**
- Nothing to judge in play; the change is test-only.

## Comments

**Mechanism.** The strip plugin no longer exempts test files, and it now also serves plain JSON imports (`import w from '…/x.json'` and eager JSON globs) as a stripped module (`?raw&stripped-json`, `export default JSON.parse(…)`). The spec session ruled the JSON imports in scope on 2026-10-26: "no module receives" covers them. `src/test/bundledWorldFiles.ts` is the one disk reader for tests that need the stored bytes.

**Sites.** Disk read: `bundledWorlds.test.ts` (shared suite, with two new guards: every image is a `data:image/` value, and the set carries images), `emberwatchWorld.test.ts` and `openChatWorld.test.ts` (each asserts an exact `runRules` set, image rules included), and the stripped-seed test (proves the stored Valentines holds images). Stripped and unchanged: the other `?raw` sites, which read ids, rules, scripts, text and image slots, and the plain JSON importers `locationGraphNeighbors`, `statCodeExecutor`, `testBench/scriptCheck` and `GamePanels`. `bundledPlayerStats` runs `runRules` but keeps only stat rows. The stripped-seed test also guards the JSON path: red when the plugin strips `?raw` only.

**Numbers.** Full `npm test` (`scripts/runTests.mjs`), same machine, same source (main at 041882f18, about 200 MB of worlds, before ticket 14's Sugarscape art), heap sampled every 25 ms in every process through a `--require` preload. No `--max-old-space-size` anywhere.

| | Before | After |
|---|---|---|
| Main process heap peak | 3,837 MB of a 4,288 MB limit (did not die on this source) | 1,395 MB |
| Largest worker heap peak | 3,617 MB | 1,416 MB |
| Wall time | 392 s | 348 s |
| Vitest transform time | 82.9 s | 53.7 s |
