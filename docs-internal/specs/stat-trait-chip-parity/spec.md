# Spec: Stat And Trait Chip Parity

Status: done
Status note: Closed 2026-11-12; tickets 01–03, last landing 9ce75cd93. Review: spec text corrected. Gates green on 2026-11-12.
Spec session: stat-trait-chip-parity — spec

## Problem Statement

Global Stats and Global Traits and the stats and traits an entity owns reach the AI through different chips. Those chips offer different choices.

- **Names-only stats can't be picked.** The Stat Detail row (Range, Descriptor, Description) locks its last checked piece on. The bare Stats chip sends names only, but after the author checks one piece, they can't uncheck back to names. Owned stat lines on the Persona and Entities chips never reach names only.
- **Global Traits always send descriptions.** Owned traits can send names only through the Content row. The Traits chip has no Content row and always sends `Name: description`.
- **The default prompts send more stat detail for the player and the cast than for the world.** Narration and Choices send Global Stats as Descriptor only. The same prompts send Persona stats and the stats of entities at the location with Range, Descriptor and Description. Early versions sent stat numbers to the narrator, and the AI leaked them into the story. The extra detail was noise. The persona and cast lines send that detail again today.

## Solution

- The Stat Detail row allows all three pieces off, on every chip. With all off, a chip sends stat names only.
- The Traits chip gets a Content row: **Description** (the default, today's output) or **Name**.
- Owned stats with all pieces off read inline in the owner's block, like owned trait names: `stats: Nerve, Patience`.
- Global Traits in Name mode list one name per line, under their group headings, like names-only Global Stats.
- The default Narration and Choices prompts send Persona and Entity stats as Descriptor only, the same detail as their Global Stats chip.
- Every default stays as it is otherwise. The bare Stats chip still sends names only, and owned stat lines still default to all three pieces. No token in a saved prompt changes what it sends.

## Rulings

Settled in the grill on 2026-11-12.

- **Q1.** Global Stats and owned stat lines keep their current defaults: names only for the Stats chip, all three pieces for owned lines. The Stat Detail row, labels and help are already the same on both, so no UI work follows. No saved or shipped token changes meaning.
- **Q2.** The Traits chip gets a Content row. The bare token keeps sending `Name: description`.
- **Q3.** The Stat Detail lock goes away on every chip. All three pieces may be off, which sends stat names only.
- **Q4.** The Traits Content row offers Description and Name only. Traits have no AI summary, so the chip offers no Summary.
- **Q5.** An owned stat list with all pieces off renders inline in its owner's block: `stats: Nerve, Patience`. That matches owned trait names in Summary or Name content.
- **Q6.** Global Traits in Name mode render one name per line, and their group headings still show. That matches names-only Global Stats.
- **Q7.** The default Narration and Choices prompts send Persona stats as Descriptor only, matching their Global Stats chip.
- **Q8.** Every Entities chip in those two prompts that sends stats also sends Descriptor only.
- **Q9.** The default-prompt change ships with probe numbers on the cloud model. The bar: the new defaults leak stat numbers or ranges into narration no more often than the old defaults. The old defaults run in the same batch as the control, with 5 or more runs per arm. The report also gives the prompt tokens saved.

### Close follow-up rulings

Settled after the close review on 2026-11-12.

- **Q10.** Names-only owned stats keep their owner's stat-group headings: an owner with stat groups lists `stats:` and then one name per line, nested under its groups. An owner with no stat groups keeps Q5's inline line (Q10b). This narrows Q5.
- **Q11.** The Test Bench's AI Context table keeps the descriptor-only Persona and Here Entities chips.
- **Q12.** The probe result stands: no regression, and 91 narration tokens saved.
- **Q13.** The trait context builder takes the chip's Content value, not a names-only boolean.
- **Q14.** The names-only render tests live with the chip-values tests, with no duplicate in the token grammar tests.

### Ticket 03 rulings

- **T03-a.** Only the chips that send stats by default change: the Persona chip and the Here-scope Entities chip in Narration and Choices. The Sublocations, Reachable and Known chips send no stats and stay as written.
- **T03-b.** The Experimental preset's own Narration prompt gets the same ids, so every built-in narrator reads stats the same way. The Simple and XML presets derive from the defaults.
- **T03-c.** "Follows the default" means the built-in presets, which read the live defaults. A user preset keeps the snapshot it stored, and a world's prompt override keeps its text. The mechanism does not change.
- **T03-e.** The bundled Open Chat world's Narration and Choices prompts get the same ids. Its prompts follow the defaults (player-character-block Q22), and its parity test stays as written.
- **T03-d.** The probe runs on the Sedge Landing scene, cloud model, with old and new arms paired by run index in one batch, 6 runs per arm per case. A leak is a stat value, range or percent in the output. The headline rate counts narration turns. Choices leaks and the per-prompt token savings are reported on their own lines.

## User Stories

1. As a world author, I want to uncheck every Stat Detail piece on the Stats chip, so that I can return to names only after I tried Range.
2. As a world author, I want to uncheck every Stat Detail piece on the Persona chip, so that the narrator knows the player's stats exist without their values.
3. As a world author, I want to uncheck every Stat Detail piece on the Entities chip, so that a roster lists each entity's stats by name only.
4. As a world author, I want names-only owned stats to read inline, so that a block shows `stats: Nerve, Patience`, the same way it shows trait names.
5. As a world author, I want a Content row on the Traits chip, so that I can send Global Trait names without their descriptions.
6. As a world author, I want the Traits Content row to offer only Description and Name, so that no option quietly means something else.
7. As a world author, I want Global Trait names to list one per line under their group headings, so that grouped traits keep their structure.
8. As a world author, I want the bare Traits chip to keep sending `Name: description`, so that my saved prompts send what they sent before.
9. As a world author, I want the bare Stats chip to keep sending names only, so that my saved prompts send what they sent before.
10. As a world author, I want owned stat lines to keep all three pieces by default, so that the Stat Updates prompt and my own prompts keep their detail.
11. As a player on the default prompts, I want the narrator to read my persona's stats as descriptors, so that the story doesn't quote numbers like "55/100".
12. As a player on the default prompts, I want the narrator to read the cast's stats as descriptors, so that characters don't recite their own stat values.
13. As a player on the default prompts, I want the choice writer to read stats the same way the narrator does, so that choices don't name numbers either.
14. As a player who edited the Narration or Choices prompt, I want my edit kept as I wrote it, so that a default change never overwrites my work.
15. As a player, I want the stat tracker to keep reading ranges and descriptions, so that stat changes stay accurate.
16. As a player using the prompt editor's Preview, I want names-only stats and trait names to preview as they will send, so that I can judge the choice before I play.
17. As a developer, I want the default-prompt change measured against the old defaults on the cloud model, so that we ship it on numbers, not one good output.

## Implementation Decisions

- **Stat Detail lock.** Remove the "last checked piece stays on" rule for the `statDetail` lock group in the Chip Options dialog. The lock group's only use was this rule, so the field is gone.
- **Names-only renders.** The Stats chip already renders names only with every piece off. The owned stat-line builder (Persona and Entities) gains the all-off case. It renders the stat names inline after the `stats` label, with no owned stat-group headings, in every format (plain, markdown, XML), the same way owned trait names render in Summary content.
- **Traits Content axis.** Add a Content axis to the Traits chip with two options: Description (`null`, the default) and Name. Use its own axis, not the Entities chip's three-option Content axis. Name mode renders one name per line and keeps group headings, in every format. A group's heading description still shows, as it does for names-only Global Stats.
- **Default prompts.** In the default Narration and Choices prompts, add the `norange` and `nodescription` ids to every Persona chip and every Entities chip that sends stats. The stored variant ids are as they are today. The default Stat Updates, Planner and Director prompts do not change. The Test Bench's AI Context table names the chips the default Narration prompt uses, so its Persona and Here Entities rows carry the same ids.
- **Saved prompts.** A player whose prompt follows the default gets the new text. An edited prompt stays as written. This uses the existing default-prompt mechanism; nothing migrates.
- **No export-shape change.** World and save files do not change. Chip variant ids live in prompt text that already exists.
- **Copy.** The Traits Content row and its option help follow the Writing Guide. Reuse the Stats chip's Stat Detail help as it is.

## Testing Decisions

A good test reads a chip's output or the dialog's state from outside, and never mirrors the builder's code. Each new guard must fail when its rule is reverted.

- **Chip Values seam.** `chipValues(scene)(token)` over the sample scene covers Q2 and Q4 to Q6: Traits Name mode with a group heading, owned stats with all pieces off in plain, markdown and XML, and the bare Traits and Stats tokens unchanged. The sample scene now has a Global Trait group and a Global Stat group. Prior art: the sample scene and chip values tests.
- **Default prompts.** Render the default Narration and Choices prompts over the sample scene with the prompt-template renderer. Assert that the Persona and Entity stat lines carry descriptors and no `/100` ranges. Prior art: the stat-prompt owner-block test in the sample scene tests. The rendered corpus snapshot records each changed token. Regenerate it once, and review its diff in the landing.
- **Chip Options dialog seam.** Uncheck all three Stat Detail pieces on the Stats, Persona and Entities chips, and read the saved token. Pick Name on the Traits Content row and read the saved token. Prior art: the Chip Options dialog tests.
- **Probe.** Run the Q9 probe on the cloud model, with the old defaults in the same batch. Report the leak rate per arm, the run counts, and the prompt tokens saved. Prior art: the probe skill and the entity stats probe harness.

## Out of Scope

- Changing any chip's default (Q1).
- A Summary option on the Traits chip (Q4).
- The default Stat Updates, Planner and Director prompts.
- A local-model probe arm.
- The other sample-data gaps from the preview sweep: the persona's Only With option, and a second played entity.

## Further Notes

- This effort came out of a preview-data sweep on 2026-11-12. That sweep also fixed the Time chip's format variants in the World Editor preview, and added the stat and trait groups to the sample scene.
- The narration prompt rules in the prompt-writing guide apply to the default-prompt change: probe numbers with in-batch controls, and no prompt text beyond the chip ids.
