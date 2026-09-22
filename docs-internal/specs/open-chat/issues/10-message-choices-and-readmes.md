# 10: Message Choices and Readmes

Status: ready-for-agent
Blocked by: 09
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A choice in Open Chat is the message the player could send back. It is the message text itself, with no quotation marks and no "I say" lead. A deed, when the player would do rather than say, sits between asterisks. Choices stay short and distinct, and the existing parser still reads them.

Rewrite the choices override from the revision 1 text. Then update both readmes for revision 2: the intro readme recommends one entity (more than one is not yet supported well) and explains the three tone groups; the gameplay readme keeps the Chat layout setting, mid-game tone switching, the bracket channel, and the choices switch. Copy follows the player-facing voice and the terminology rules. Run the copy sweep. Update the Changelog In-Progress entry if its wording no longer fits.

Read the prompt-writing guide before editing. Follow it: positive contract, generic examples only, no parrotable values.

## Acceptance criteria

- [ ] A/B probe with the revision 1 choices prompt as the baseline arm, on both reference tiers, at least 2 runs per case, one imported card as the fixture
- [ ] Metrics with numbers per arm under Comments: parse success, count in 3 to 5, lines with no quotation marks, lines with no "I say" or "I ask" lead, words per choice
- [ ] The regression check from the guide passes on distinctness and the no-entity guard case
- [ ] The intro readme recommends one entity and names three tone groups; the content test's label checks match
- [ ] The gameplay readme holds no setup guidance, and every setting it names matches its live label
- [ ] The copy sweep reports no findings
- [ ] One full turn in the Chat layout shows a message reply and message choices, checked live
- [ ] Four gates green
