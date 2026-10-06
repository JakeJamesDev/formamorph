# 01: Diagnose the Bar

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: open-ended profiling: heap retainer analysis and IndexedDB timing decide whether the effort's bar holds, and a wrong read misdirects ticket 13.

## What to build

Measure what the Q1/Q8 bar rests on before tickets aim at it (Q19). Using the editor-speed harness world and a production build at 6x:

- Take a heap snapshot on the Main Menu with the bench world in the library and name the top retainers of the 823 MB. Run the same with an empty library as the control, so "menu heap no longer grows with library size" can be checked.
- Time a bare IndexedDB get and put of the bench world record at 6x, outside the app, to find the structured-clone floor for open and save.
- Add the empty-library control and any needed measurement to the harness so later tickets can re-run it.

Write the findings in this ticket under `## Findings` and fold a summary into the spec's Further Notes. If the get or put alone blocks over 1 s, or the menu heap has a retainer this effort can't remove, say so: the spec session brings Q1/Q8 back to the user before ticket 13 starts. No product code changes.

## Acceptance criteria

- [ ] Findings name the top Main Menu heap retainers with sizes, for the bench library and the empty library.
- [ ] Findings give bare IndexedDB get and put times of the bench world at 6x (median of 3).
- [ ] The harness can run with an empty library (documented flag) and reports Main Menu heap.
- [ ] Findings state, for each of Q1 (open, save) and Q8, whether the bar is reachable without the blob store, with the evidence.
- [ ] No change under `src/`.
