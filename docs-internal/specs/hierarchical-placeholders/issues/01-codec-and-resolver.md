# 01 — Token codec + recursive resolver (pure)

Status: done

Spec: `../spec.md` (Implementation Decisions: Schema, Token codec, Resolution, Rolls, Pins).

## Scope

- Extend the placeholder token codec with optional path segments (`val` by target id, `slot` by
  name); old tokens parse as empty-path tokens.
- Add `roll?: boolean` to the placeholder type; absent = inferred from value count (today's
  semantics).
- Rewrite resolution as the recursive walk from the prototype: choice/record/single-value,
  authored-vs-typed drill precedence (pin > authored drill > roll; typed segments pin-immune),
  slot routing, cycle guard + depth cap, all-zero-weight uniform fallback, benched 0-weight
  values.
- Rolls store raw value content; World keys by placeholder id, Unique keys the subtree under the
  placement chain (full parity for chips inside values).
- Findings (slot miss, dangling ref, cycle, depth) reported to the caller for later Bench use.

## Done

- All existing placeholder unit tests pass unchanged, plus new fixtures from the seven prototype
  walkthroughs and a legacy byte-identity case (flat placeholders + legacy rolls resolve exactly
  as the shipped resolver does).
- Four gates green. Pure module only — no context/UI changes in this ticket.
