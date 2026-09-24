# 03: Authoring Tour Tracer on Overview

Status: ready-for-human
Base: 7b6207bd
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

**Parent:** [Authoring Tour](../spec.md)

**What to build:** An author creates a new world. A one-time note offers the Authoring Tour, with **Start Tour** and **No Thanks**. **Start Tour** runs the tour on that world through the two Overview steps: World Name, then AI-Facing Description. After the last step, the tour ends.

The tour works end to end without In Play, which arrives in ticket 04:

- **Step note.** An anchored, non-modal note with **Previous**, **Next**, **Use Example** and a counter. **Next** is disabled until the field has a value. **Use Example** fills the Appendix A value through the panel's own setter.
- **Tour bar.** It sits in the editor header and shows "Authoring Tour · 1 / 2", **Back to Tour** and **End Tour**.
- **Editor mode.** Simple is forced through a mode override. The stored preference is never written. The Simple/Advanced toggle is disabled with a tip that says why.
- **Saving.** The tour runs the editor's own Save after each completed step.
- **Resume.** Progress is keyed by world id in localStorage. Reopening the world resumes at the stored step. **End Tour** or finishing clears the record. Records for deleted worlds are pruned.

This ticket sets up the Authoring Tour module: the step registry, the progress store and the controller. It also sets the `data-tour-anchor` convention and adds a dev route that opens the tour at a named step. Every later ticket builds on these.

**Rationale for the model:** new module, state machine, persistence, mode override and layering with the existing tutorial layer. Every later ticket depends on it, so Opus at high effort.

## Acceptance criteria

- [x] The step registry is the only place that defines a step. Each step declares its id, tab, anchor, tour item, completion predicate over the world, example value and In Play slice. The slice is empty until ticket 04.
- [x] Anchors use a stable `data-tour-anchor` attribute on each field's existing wrapper. The note positions against that element. No step anchors by label text.
- [x] The note reuses the tutorial layer's look, its topmost-screen layering, and its stand-down while a modal covers the anchor.
- [x] The tutorial note component gains an optional second action. The new-world offer uses it for **Start Tour** / **No Thanks**.
- [x] The offer's seen-state id is shared, so ticket 10's first-visit offer can reuse it. **No Thanks** retires it for good.
- [x] Steps never auto-advance. A step whose field already has a value shows with **Next** enabled.
- [x] **Back to Tour** switches to the step's tab and returns focus to the step's field.
- [x] While the tour runs, the editor shows Simple, the stored mode preference is unchanged, and the toggle is disabled with its tip. With the tour off screen, the author's own mode shows.
- [x] The world is persisted after each completed step. A new world is stored after the World Name step.
- [x] Unmounting and remounting the editor on the same world resumes at the stored step. **End Tour** clears the record.
- [x] The dev route opens the World Editor with the tour at a named step. The dev-route drift guard covers it.
- [x] Tests run through the World Editor Bench harness and drive the tour as a user does: offer, Start Tour, Next gating, Use Example, Previous, End Tour, save, resume and mode.
- [x] A drift test iterates the registry and asserts that each step's anchor renders on its tab. Prove it by removing one anchor attribute and watching it fail.
- [x] A tour test that presses Escape waits for the note to stand down first. See the known Escape trap in the spec.
- [x] Preview check through the dev router at 1280 and 375 wide: the note, the tour bar and the disabled toggle, with static DOM evidence.
- [x] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph. Add one 👤 changelog entry for the Authoring Tour in the In Progress section. Later tickets adjust this entry and do not add new ones.

## Scope notes

- **No world or save export-shape change.** All tour state is local.
- Build on `feature/authoring-tour` in the worktree.

## Comments

**2026-09-23, implementation notes**

- New World names the world "New World", so on a new world the World Name step opens with **Next** already enabled. This follows "a step whose field already has a value shows with **Next** enabled". **Resolved:** the default name does not count as a value, and [ticket 14](14-world-name-step-ignores-the-default-name.md) builds it.
- The last step's button reads **Finish**, not **Next**.
- The mode note ("Simple vs. Advanced") waits while the offer or the tour is up, because the tour locks the switch it explains.
- The offer shows only on the world New World made. A world loaded over it from a file gets no offer.
- The step ids sit in the dev-route ledger as well as the registry. `devRouter.test.ts` guards that the two match.
