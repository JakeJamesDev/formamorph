# 05: Server: scramble format and shared vectors

Status: ready-for-agent
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

- [ ] Scrambling is deterministic for a given seed and format version.
- [ ] Two seeds give two different outputs; no tile stays in its source position for the vector seeds.
- [ ] Image sizes that don't divide by the grid are handled, and the vectors cover one.
- [ ] A server-side unscramble used only in tests restores the source exactly from every vector.
- [ ] The vectors are committed fixtures, in a form the client can copy unchanged.
