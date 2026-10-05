# 15: Search naming, Backdrop label and Search copy

Status: done
Blocked by: 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The player-facing names say what each thing does.

- "Pick" becomes **Search** everywhere the player sees it: the Endpoint tab's route (Search Endpoint, with Same as Answer), the Prompts tab's prompt and its Options, AI Context's request names, and the guide. The General tab switch becomes **AI Search**. Code names may follow; the help preset file and the help settings value have never shipped, so a renamed key changes in place with no reader for the old one (Q33). **Export-shape change if the preset file keys change: say so in the response.**
- The readability setting's label becomes **Backdrop** with the hint "Shades the screen behind the chat so the text stands out".
- Search section hints and the Search Endpoint hint take the Q50 lines. Each is 12 words or fewer, the copy guard's cap.

Spec: Q48, Q49, Q50; Implementation → Help settings, Endpoint tab, Prompts tab.

Recommended model rationale: a rename sweep and five copy lines, guarded by the copy tests.

## Acceptance criteria

- [ ] No player-facing string says "Pick" for the search request; a source test over the Formaquestion copy proves it.
- [ ] The Endpoint tab's two route fields fit one row without wrapping at the dialog's width.
- [ ] The General tab shows Backdrop and the Q50 hints; the copy sweep passes.
- [ ] The four gates are green.
