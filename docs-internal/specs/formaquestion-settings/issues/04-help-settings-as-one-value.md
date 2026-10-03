# 04: Help settings as one value

Status: done
Base: d8273706
Blocked by: None (can start immediately)
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A prefactor with no behavior change. It starts after Formaquestion ticket 46 is `ready-for-human` (Q4), because it edits the help session that the bar run measures.

- **A help settings module.** One pure module, with no React, defines the Formaquestion settings as one value with defaults. This ticket adds the fields that replace constants of today: the three search source switches, lookup mode, the history length and the answer cap. Later tickets add their own fields. The answer samplers are not in this ticket: today they are a request-kind pin that the pick request shares, so ticket 13 adds the field together with the call-level override that separates the two (Q50).
- **The help session reads that value.** A help question carries the settings. The session reads no setting from a constant. The constants become the defaults of the module, with the same values.
- **The window passes the defaults.** Nothing is stored yet, and no control exists yet.
- **Tests and probes pass their own value.** The per-question overrides of today (the source switches, lookup mode) fold into the settings value. The probe harnesses keep their arms.

Recommended model rationale: the settings value is the seam every later ticket builds on, and the probe harnesses must keep the same numbers.

## Acceptance criteria

- [ ] The help session takes the settings in the question, and a source scan or a test shows that it reads no source, lookup, history or cap constant directly.
- [ ] A test asserts that each default equals the value the constant had.
- [ ] The request bodies of the existing help session tests are byte-equal before and after.
- [ ] The probe harnesses run with the default settings and with their existing arms.
- [ ] The four gates are green.
