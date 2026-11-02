# 09: Card Import Keeps Self Openings

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one reader function and one round-trip test.

## What to build

An entity card writes each opening's Self mark, but card import rebuilds each opening without it, so Self openings come back as Others. Keep the mark on import. Export is unchanged, so the card shape doesn't change.

Spec: Implementation Decisions "Card openings". Evidence: docs-sweep ticket 07, Landed.

## Acceptance criteria

- [x] A card round-trip test with one Self and one Others opening fails today, then passes with each mark kept (`keep each opening’s Self mark through a card round trip` in `entityFile.test.ts`; red before the fix)
- [x] The World-Editor-Openings sentence on what travels in a card names the Others/Self switch; the docs tests are green (review gates and the full gate list in prepare)
- [x] A changelog fragment under Minor / Fixed / 👤 (`docs-internal/changelog.d/docs-sweep-bugs-09.md`)

## Landed

**Not verified**
- None.

**For you**
- None.
