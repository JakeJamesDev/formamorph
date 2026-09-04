# 01 — Placement math + band rendering

Status: done

Client half of the model, no UI yet.

- Add `posterPlacement: { zoom: number; x: number; y: number } | null` to the event types
  (`ServerEvent` + `ServerEventDraft` in `src/types/events.ts`).
- Generalize `coverScale`/`clampCrop` in `src/lib/avatarCrop.ts` from a square `frame` to a
  w×h rect; avatar callers keep passing squares (no behavior change there — their tests prove it).
- Extend `posterBand()` in `src/lib/posterStyle.ts` to compose the artwork layer's positioning
  from a placement: scale = cover × zoom, focal point (x/y as source-image fractions) centered,
  clamped to slack. `null`/absent placement must reproduce today's output exactly.
- `EventPosterBand` applies the computed positioning to its artwork layer (stays a decorative
  background, not an `img`).

Tests: rect cover/clamp at both orientations and at the bounds; focal round-trip at wide vs tall
frames (same stored value centers the same source pixel); `posterBand` null-placement snapshot
unchanged. Mutation-test the clamps.
