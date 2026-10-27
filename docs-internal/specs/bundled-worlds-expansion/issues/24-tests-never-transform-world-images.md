# 24: Tests Never Transform World Images

Status: ready-for-agent
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

- [ ] A test proves a test file's own `?raw` import of a bundled world arrives stripped, and goes red with the plugin's test-file exemption restored.
- [ ] The shared suite's Test Bench pass runs on real image bytes: a mutation that inserts a non-WebP image into a disk-read world makes `image-not-webp` fire in the suite.
- [ ] The full suite is green with the default heap in the main process and the workers. Main-process and largest-worker peak heap, before and after, are in the comments.
- [ ] Ticket 14's prepare gate passes on a rebase over this landing, reported by ticket 14.
- [ ] No changelog fragment; the change is test-only.

## Landed

## Comments
