# 08: Traits Steps

Status: ready-for-human
Status note: Built in 21341944, with the review folded in. Open question: the Test Bench readers read the authored stat value, not the settled start. A world with a default trait that changes a stat would show the difference.
Base: a3685c8b
Blocked by: 07
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Authoring Tour](../spec.md)

**What to build:** After Stats, the tour builds one trait where the editor's Add button puts it. In Play shows what a player picks and what the AI learns.

| Step | Player Sees | Narration Prompt Reads |
|---|---|---|
| Add a trait | (the Add button is the anchor) | none |
| Name with Player-Facing Description | Setup screen trait list | "The AI never reads" the Player-Facing Description |
| AI-Facing Description | "Players never see this field" | The traits block with the tour trait active, marked |
| Stat Change | Setup screen stat change, and the stat row at the settled starting value | The traits block |

The Stat Change targets the tour stat from ticket 07. The stat row shows the value a new game really starts with. It is settled through the Opening instrument's machinery, so deltas and clamps apply as in play.

**Use Example** values come from Appendix A: Tide-Touched, with Sea Change +15.

**Rationale for the model:** follows the established pattern. It reuses the Opening instrument's stat settling. Sonnet at high effort.

## Acceptance criteria

- [x] All four steps run in order, and each saves when it completes.
- [x] Player Sees uses the setup screen trait list from ticket 02, and the real stat row.
- [x] The traits block comes from the Test Bench builders, with the tour trait active.
- [x] The stat row's value is the settled starting value, not the raw sum. A test proves that a clamp applies.
- [x] The Stat Change step completes when the trait has a change on the tour stat.
- [x] Tests through the World Editor Bench harness cover each slice, the marks, and the settled value.
- [x] Preview check through the dev router: the Stat Change step, with static DOM evidence.
- [x] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- Build on `feature/authoring-tour` in the worktree.

## Comments

**Ruling from the spec session (2026-09-23).** The trait goes where the Traits tab's **+** puts it, at the root. The setup screen shows it under "General", and In Play shows that as it really renders. The ticket's "seeded Player group" wording was dropped. **Use Example** writes Sea Change +15 as a "Starting Value" change, because that type moves the starting value.

**Build notes.** In Play applies the tour trait through the Test Bench lens: the trait stands in as the lens character, which applies it the way ticking it on the setup screen does (the world's defaults, with its exclusive siblings retired). The traits block is the AI Context builder's `traits` block under that lens. The Stat Change step's stat row shows the value the Opening instrument settles (`settledOpeningStats`), so trait deltas and clamps apply. The Stats steps keep the authored start, because their two readers read the authored value too. The setup screen's category walk moved out of `EnterWorldWorkspace` into `src/lib/setupTraitWorkspace.ts`, so In Play finds the tour trait's category with the screen's own code. `newTrait` and `traitRootCount` moved into `blankWorld`, so the editor's Add and the dev-route replay build the same trait. Test wall time after the review follow-up: 108 s for the full suite (107 s reported by Vitest), all 12,763 tests passing.

**Preview evidence (dev router, 1440×900).** `#dev?modal=worldEditor&tour=trait-stat-change`: the tour bar read "22 / 27" and **Next** was disabled. After **Use Example**, **Next** was enabled. Player Sees held the setup screen's "General" category with Tide-Touched ticked (`aria-checked="true"`), its Player-Facing Description and "Sea Change: +15". Below it, "When a new game starts" and the stat row read "Sea Change", "15 / 100", with a 15% bar. Narration Prompt Reads was `- **Tide-Touched:** The player bathed in the Tidewell…` with no marks.
