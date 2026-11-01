# 12: Import Cost

Status: ready-for-agent
Blocked by: 08, 09, 10, 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: Production import changes must keep behavior and bundles intact while cutting a cost that is spread widely.

Parent: [Test Sweep spec](../spec.md)

## What to build

Collection time falls through import changes (Q15). The ledger names the imports that cost most across test files. Split barrels and defer heavy imports where behavior stays the same, and tune setup files and environments where evidence supports it. Isolation stays on. Features can run again from this step, so check parallel sessions before each shared edit.

Rulings: Q1, Q15.

## Acceptance criteria

- [ ] Collection, setup and environment times before and after are recorded, from runs under comparable load.
- [ ] Each production import change is listed with what it saves.
- [ ] The app and site bundle sizes before and after are recorded, and `site`'s boundary still holds.
