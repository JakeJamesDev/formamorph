# 14: Scanners To ESLint

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: Each conversion is small, but each must keep what the scan guarded.

Parent: [Test Sweep spec](../spec.md)

## What to build

Source-scanning tests become ESLint rules where a rule can express them (Q10). Scans of docs, CSS and worlds stay tests. The changed-file lint only sees changed files, so `npm run lint` on the whole repo must stay clean to keep each guard honest. Remove converted entries from the always-run list.

Rulings: Q10, Q26.

## Acceptance criteria

- [ ] Each converted scan has rule tests, with valid and invalid cases.
- [ ] Reintroducing each scanned problem produces a lint error.
- [ ] The always-run list is smaller by the converted entries, and each scan that stayed has a stated reason.
