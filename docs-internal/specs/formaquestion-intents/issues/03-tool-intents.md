# 03: Tool Intents

Status: ready-for-agent
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

- [ ] A Tool goes out only on the Intents its list holds: `askHelp` tests per Intent
- [ ] A Tool with no list goes to Help, Code and World, and not to Chat or Create
- [ ] The fallback request offers every Tool that is on
- [ ] The multiselect saves the list, and the editor shows the default for a Tool with none
- [ ] A pack and a help preset file with the list round-trip; one without it loads with the default
- [ ] ADR-0010 carries the amendment, and the player docs describe the list

For you: open the Formaquestion Tool editor and judge whether the Intents control reads clearly beside the other Tool fields.
