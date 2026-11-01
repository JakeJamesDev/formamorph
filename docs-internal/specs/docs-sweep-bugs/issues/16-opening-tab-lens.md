# 16: Hide the At Pick on the Opening Tab

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: the bench tab table gains per-part lens flags and the lens bar reads them.

## What to build

The Test Bench Opening tab shows the whole **Testing as** / **at** bar, but Opening reads only the PC and starts at its own **Starting Location** pick. Ruling Q6: hide the **at** pick on the Opening tab. The bench tab table names which lens parts each tab reads, and the lens bar draws only those parts.

Spec: Q6, Implementation Decisions "Opening lens". Evidence: docs-sweep ticket 15, Landed.

## Acceptance criteria

- [ ] A Test Bench test on the Opening tab fails today (a **Testing at** picker shows), then passes with only **Testing as**
- [ ] The tabs that read the location still show **at** (test)
- [ ] The Test-Bench page's Opening sentence matches; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤
