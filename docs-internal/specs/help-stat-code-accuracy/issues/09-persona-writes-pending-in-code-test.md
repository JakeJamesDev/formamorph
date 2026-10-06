# 09: Persona Writes Pending In Code Test

Status: done
Blocked by: 06 — Code Test Function
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a result-shape change in the code test's executor with a sandbox-semantics edge; the editor's Test Code must stay untouched.

## What to build

Morphie's code test runs on the authored world with no playthrough, so `persona` is the empty entry and holds no traits. Today a write through it, such as `persona.traits.Seasoned.enabled = true`, comes back as a dropped write, and the function's guidance tells her to fix correct code. After this ticket, on an authored-world run the code test reports a `persona` trait write as **pending**: a write that lands on the played persona in a real turn. It is listed apart from dropped writes, and the function's description tells the model a pending write is not an error. A persona write to a trait name that no persona-capable entity holds stays dropped. The editor's Test Code button is unchanged.

## Acceptance criteria

- [ ] On an authored-world run, `persona.traits.<Name>.enabled = …` with `<Name>` held by a persona-capable entity returns a pending write, not a dropped one
- [ ] A persona write to a name no persona-capable entity holds stays a dropped write
- [ ] The function's description names pending writes and says they are not errors
- [ ] The editor's Test Code output is byte-identical for the same code (test in place)
- [ ] The no-world run (Q27) is unchanged
- [ ] Changelog fragment written

## Notes

Ticket 08's branch (`ticket/help-stat-code-accuracy-08`) holds a harness test that runs the code test on each known case's fixture world and expects the guide's code to test clean. It fails today on the persona case and goes green once this ticket lands. Use it as a check; land your own test too, since 08 has not landed.
