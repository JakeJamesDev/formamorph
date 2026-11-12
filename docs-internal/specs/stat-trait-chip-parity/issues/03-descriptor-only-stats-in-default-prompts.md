# 03: Descriptor-Only Stats In Default Prompts

Status: ready-for-agent
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

- [ ] The default Narration and Choices prompts, rendered over the sample scene, carry the Persona and Wren stat lines with descriptors and no `/100` ranges or stat descriptions.
- [ ] The default Stat Updates prompt still renders `Nerve: 55/100` and `Patience: 70/100`.
- [ ] The probe report gives the leak rate for both arms, 5 or more runs each, from one batch. The new arm leaks no more than the control.
- [ ] The rendered corpus diff holds only the changed Persona and Entities tokens.

For you: read two or three probe narrations from the new arm and judge whether the stats still shape the story (in the probe output folder the report names).
