# 08 — Trait pins + display polish

Status: done
Blocked by: 04

Spec: `../ui-spec.md` (Trait pins, Display decisions).

## Scope

- Trait pin pickers render chip-bearing values through the describe pass; pinning a chip value
  pins the variant. No new pin mechanism.
- Display sweep: full-path labels with › on in-field path chips everywhere chips render;
  read-only pills keep the existing display matrix; red-? treatment covers a deleted mid-path
  target.
- Kind nouns (Variable/Wildcard/Object) swept through placeholder UI copy and the structured
  Bench rule wording, one term per thing.

## Done

- Tests: pin picker describes a chip value, pinned variant resolves in play (harness-level),
  red-? on dangling path. Mutation-proven where guarding.
- Live-verified via dev-router, both themes if colors touched; four gates green; changelog
  entry appended.
