# 03: Descriptor-Only Stats In Default Prompts

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The default Narration and Choices prompts send Persona stats and Entity stats as Descriptor only, the same detail as their Global Stats chip. The narrator stops reading stat numbers, so it stops quoting them.

- In both default prompts, add `norange` and `nodescription` to every Persona chip and every Entities chip that sends stats. Change no other prompt text.
- Leave the Stat Updates, Planner and Director prompts as they are.
- Players whose prompt follows the default get the new text; edited prompts stay as written. Confirm the default-prompt mechanism already does this, and change nothing there.
- Probe first, per the `probe` skill: cloud model, the old defaults in the same batch as the control, 5 or more runs per arm. Count the narration turns that show a stat number or range. Use a world whose persona and present entities own stats. Report the leak rate per arm, the run counts and the prompt tokens saved, in the landing body and the ticket's `## Landed` section.
- If the new arm leaks more than the control, stop and report to the spec session. Don't ship it.
- Regenerate the rendered corpus snapshot once, and check that its diff holds only the changed Persona and Entities tokens.
- Changelog fragment in `docs-internal/changelog.d/` (Fixed: the narrator and choices no longer read the player's and cast's stat numbers).

Spec rulings: Q7, Q8, Q9.

## Acceptance criteria

- [x] The default Narration and Choices prompts, rendered over the sample scene, carry the Persona and Wren stat lines with descriptors and no `/100` ranges or stat descriptions. (`sampleScene.test.ts` "sends the persona and cast stats to the default … prompt as descriptors only", for Narration, Choices and Experimental narration; fails when one chip goes back to the old form.)
- [x] The default Stat Updates prompt still renders `Nerve: 55/100` and `Patience: 70/100`. (`sampleScene.test.ts` "fills both owner blocks of the default stat prompt", unchanged and green.)
- [x] The probe report gives the leak rate for both arms, 5 or more runs each, from one batch. The new arm leaks no more than the control. (`descriptor-stats-probe.cli.ts`, cloud `default`, one batch, 6 runs per arm per case; numbers below.)
- [x] The rendered corpus diff holds only the changed Persona and Entities tokens. (`tokenCorpus.rendered.json` gains exactly 4 keys: the Persona and Entities `norange.nodescription` forms.)

For you: read two or three probe narrations from the new arm and judge whether the stats still shape the story (in the probe output folder the report names).

## Landed

Probe (`testing/baseline/harness/descriptor-stats-probe.cli.ts`, Sedge Landing, cloud `default`, old and new paired in one batch, 6 runs per arm per case):

| | Old (Range, Descriptor, Description) | New (Descriptor only) |
|---|---|---|
| Narration stat-number leaks (3 cases) | 0/18 | 0/18 |
| Choices stat-number leaks (2 cases) | 0/12 | 0/12 |
| Narration prompt tokens | 1399 | 1308 (91 saved) |
| Choices prompt tokens | 1006 | 945 (61 saved) |

Label leaks were 0 in every arm, and choices kept their format 12/12 in both arms. The narration showed the player shaken in 2/18 old and 5/18 new runs. The old arm leaked nothing either, so this batch shows no regression, not a reduction.

Spec-session rulings T03-a to T03-e: the Experimental narration prompt and the bundled Open Chat world got the same ids, so the Open Chat shipped fingerprint moved.

The Test Bench's AI Context table names the chips the default prompts use, so its Persona and Entities Here blocks now show descriptors only. The authoring tour reads the narration chip through that table. A stat with no descriptors now sends its name only to the narrator, as a Global Stat with no descriptors already did.

**Not verified**

- Nothing left unticked.

**For you**

- Read two or three probe narrations from the new arm and judge whether the stats still shape the story (in the probe output folder the report names): `.scratch/stat-trait-chip-parity-03/frames/probe-new.md`, with the control in `probe-old.md` beside it.
