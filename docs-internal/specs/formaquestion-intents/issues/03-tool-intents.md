# 03: Tool Intents

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one optional field, a reused control, and round-trip tests.

## What to build

Each Formaquestion Tool chooses the Intents it goes to.

- The Formaquestion Tool editor gets an Intents multiselect, the same control a Tool uses for the prompts it goes to (Q54).
- A Formaquestion Tool gains an optional Intent list. An absent list reads as Help, Code and World, so Tools saved before this change keep reaching those three (Q66, Q67). A gameplay Tool never carries one.
- The answer request offers a Tool only when its list holds the question's Intent. The fallback request offers every Tool that is on.
- The help settings value, the help preset file's Tool copy and the Tool pack file carry the list.
- Amend ADR-0010, which says the help request has no "Offered To" to choose. The player docs on Formaquestion Tools describe the list.

Spec: Q54, Q65–Q67; stories 37–39.

## Acceptance criteria

- [x] A Tool goes out only on the Intents its list holds: `askHelp` tests per Intent (`sends a Tool that lists only %s to that Intent alone`); removing the plan filter turned 8 tests red
- [x] A Tool with no list goes to Help, Code and World, and not to Chat or Create (`sends a Tool with no list to %s`)
- [x] The fallback request offers every Tool that is on (`offers every Tool that is on, whatever its list holds`)
- [x] The multiselect saves the list, and the editor shows the default for a Tool with none (`show Help, Code and World for a Tool with no Intent list…` in `FormaquestionToolsTab.test.tsx`)
- [x] A pack and a help preset file with the list round-trip; one without it loads with the default (`toolPack.test.ts`, `helpPresetFile.test.ts`, `helpTools.test.ts`)
- [x] ADR-0010 carries the amendment, and the player docs describe the list

For you: open the Formaquestion Tool editor and judge whether the Intents control reads clearly beside the other Tool fields.

## Landed

**Not verified**
- The editor control in the live app: only jsdom tests read it. No frame was taken.

**For you**
- Open Formaquestion Settings → Tools, select a Tool of your own, and judge whether the **Sorted As** control reads clearly beside **Max Calls per Request**. I labeled it with the Sort Questions words (Small talk, How-to, Code, Your world, Make something) instead of the glossary words, per the Writing Guide. Say if you want other words.
- Export shape: a Tool pack and a help preset file from the Formaquestion list now carry the optional `intents` list on each Tool (additive). Files without it load with the default.
- Gameplay Tools never carry the list: the pack and preset readers keep it for the Formaquestion list only.
