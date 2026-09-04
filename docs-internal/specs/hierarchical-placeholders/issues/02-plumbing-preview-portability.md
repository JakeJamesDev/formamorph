# 02 — Priming, session plumbing, Preview, describe, portability

Status: done
Blocked by: 01

Spec: `../spec.md` (Implementation Decisions: Eager priming, No-roll surfaces, Portability).

## Scope

- Eager priming recurses through value chips so save activation still rolls everything up front;
  keep the Bench's exported mirror of the priming field list in sync (one list, no third copy).
- Session/resolved-world plumbing carries structured rolls; trait pins keep storage and mask
  semantics (broken pin still applies).
- Author-time Preview rolls structured placeholders like play does.
- Describe pass mirrors resolution, depth-capped (~2): choice → `{a|b|c|…}`, record → joined
  descriptions; existing pins-argument order preserved.
- Portability: used-placeholder collection becomes transitive through value chips; absorb dedup
  compares full value lists + weights; remap rewrites path segment ids too.

## Done

- Existing session and panels tests green, including the two mutation-proven guards.
- New tests at the same seams for transitive collection, absorb dedup of structured defs, and
  Preview determinism (injected picker).
- Four gates green.
