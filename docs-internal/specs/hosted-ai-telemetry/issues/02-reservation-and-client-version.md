# 02: Reservation And Client Version On Usage Rows

Status: ready-for-agent
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

- [ ] An additive schema step adds the capped `max_tokens`, reservation, client version and upstream provider columns, all nullable.
- [ ] A row opens with the capped `max_tokens` and reservation that admission computed, and settling leaves them unchanged.
- [ ] A retry row carries the capped `max_tokens` and client version, and stores its own reservation.
- [ ] A call with a valid client header reports under that version.
- [ ] A call with no client header or an unreadable one reports under null, never under `0.0.0`.
- [ ] The `reservations` section shows per prompt type and overall the summed reservation, the summed cost and their ratio. Only `ok`, `upstream`, not stopped rows with a reservation count.
- [ ] The `clients` section shows per version calls, turns, cost and closed turns with no narration call.
- [ ] Calls in both sections count every row, retries included.
- [ ] A reported reservation matches the worst case of the call's estimated prompt and capped `max_tokens`.
