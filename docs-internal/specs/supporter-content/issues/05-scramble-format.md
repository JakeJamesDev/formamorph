# 05: Server: scramble format and shared vectors

Status: done
Base: c8420be
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: a small, fully specified pure transform plus test vectors.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings.

## What to build

A versioned, pure scramble step: cut an image into a fixed grid of tiles and shuffle them by a permutation derived from a seed (Q4). Its inverse lives in the client (ticket 11). Write a set of shared vectors (source, seed, format version, scrambled output) that both repos test against.

## Acceptance criteria

- [x] Scrambling is deterministic for a given seed and format version. (`scramble › is deterministic for a seed`; committed bytes match)
- [x] Two seeds give two different outputs; no tile stays in its source position for the vector seeds. (`gives two seeds two different outputs`; `moves every tile that holds art` per vector)
- [x] Image sizes that don't divide by the grid are handled, and the vectors cover one. (pad to a multiple of 8; `unaligned-21x13` and `tiny-3x5`)
- [x] A server-side unscramble used only in tests restores the source exactly from every vector. (`unscrambles to the source exactly`)
- [x] The vectors are committed fixtures, in a form the client can copy unchanged. (`tests/fixtures/scramble-vectors.json`, base64 RGBA)

## Landed

**Not verified**

- None.

**For you**

- Ticket 10 must send scrambled layers lossless, with `{ seed, version, sourceWidth, sourceHeight }` beside each file. Client ticket 11 copies `tests/fixtures/scramble-vectors.json` and the algorithm in `src/utils/scramble.js` (pad to 8, 8x8 grid, Sattolo over mulberry32).
