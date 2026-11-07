# 02: Reservation And Client Version On Usage Rows

Status: ready-for-human
Base: f66b143
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-telemetry/spec.md` in formamorph (Usage row fields, report `reservations` and `clients`)

Model rationale: touches the admission and retry path, and the report's row filters decide whether the ratio means anything.

## What to build

Each usage row keeps the capped `max_tokens` and the reservation it was admitted on, and the calling build's version. An admin reads the usage report's new `reservations` section to see where the estimate runs high, and its `clients` section to tie calls and turns with no narration call to a build.

This ticket owns the one additive usage-column step. It adds all four columns, the upstream provider column included, which ticket 03 fills.

## Acceptance criteria

- [x] An additive schema step adds the capped `max_tokens`, reservation, client version and upstream provider columns, all nullable. (`hostedUsageTelemetry schema step` test)
- [x] A row opens with the capped `max_tokens` and reservation that admission computed, and settling leaves them unchanged. (`keeps the capped max_tokens and the reservation…` test; mutation: settle overwriting the reservation goes red)
- [x] A retry row carries the capped `max_tokens` and client version, and stores its own reservation. (`gives a retry the capped max_tokens…` test)
- [x] A call with a valid client header reports under that version. (`reports a valid client header…` test, prerelease kept verbatim)
- [x] A call with no client header or an unreadable one reports under null, never under `0.0.0`. (same test: none, `garbage`, `0.0.0 web`)
- [x] The `reservations` section shows per prompt type and overall the summed reservation, the summed cost and their ratio. Only `ok`, `upstream`, not stopped rows with a reservation count. (`sums only settled upstream-priced rows…` test; ratio = cost / reservation per the spec ruling)
- [x] The `clients` section shows per version calls, turns, cost and closed turns with no narration call. (`judges a turn on all its rows…` test, per the first-row ruling)
- [x] Calls in both sections count every row, retries included. (retry test: `clients` counts both rows, `reservations` counts the retry; `reservations` counts its filtered rows per the spec ruling)
- [x] A reported reservation matches the worst case of the call's estimated prompt and capped `max_tokens`. (first test: `estimated_prompt_tokens × 1 + 1000 × 3` with `max_tokens: 5000` sent)

## Landed

**Not verified:** nothing left unticked. All 12 mutations of the new logic went red on the expected test.

**For you:**
- The `npm test` gate went red twice on timing-sensitive stream tests in `tests/hostedAiRetry.test.js` (a 100 ms gap measured as 85 ms, then an error-frame body mismatch). They failed under full-suite load, passed in 3 of 3 runs of the file on its own, and the diff does not touch the stream path. The next run went green. A follow-up could harden those timings.
- `clients.turns` counts distinct turns in the range's rows. Only `turnsWithoutNarration` uses the first-row rule.
