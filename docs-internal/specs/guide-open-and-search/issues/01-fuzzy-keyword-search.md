# 01: Fuzzy Keyword Search

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Docs Index keyword search matches partial words and close spellings. Every caller gets it: the Search tab, Ask's keyword source, the docs lookup function and the Ask fallback (Q3, Q10).

- A query term with no exact match expands to vocabulary terms that start with it, or that are one edit away (two for long words).
- An expanded term counts for less than an exact one, so a correct word still finds its own section first.
- A term too short to expand stays exact. The existing two-letter search floor stays.
- The index builds its vocabulary once. The existing rules hold: hub penalty, What's New lead, favored page, changelog last.

Spec: Implementation Decisions → Docs Index keyword search; fuzzy matching is on for every caller.

Recommended model rationale: ranking design inside a tuned BM25 index, where a weight choice moves the Ask probes.

## Acceptance criteria

- [ ] A partial word ("plac") and a one-letter typo ("placholder") find the placeholder sections; proven to bite by reinstating the exact match.
- [ ] An exact match ranks above a close spelling of equal strength.
- [ ] A short term does not expand.
- [ ] Hub, What's New, favored-page and changelog-last tests still pass unchanged.
- [ ] Changelog fragment written; four gates green.
