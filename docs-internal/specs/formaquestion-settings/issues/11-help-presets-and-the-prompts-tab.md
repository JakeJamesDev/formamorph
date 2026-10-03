# 11: Help presets and the Prompts tab

Status: done
Base: 9fcc55cb
Blocked by: 05
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A power user changes the help prompts, as they change the gameplay prompts (Q8, Q9, Q10, Q24).

**The preset store.**

- Formaquestion has its own preset list, apart from the gameplay prompt presets.
- One built-in preset, **Default**, is read-only. Its text comes from the code, so each release updates it for every player who has no custom preset.
- A player duplicates a preset to get a custom one, and can rename and delete a custom preset.
- A preset holds three texts: the answer prompt, the pick prompt and the lookup prompt. It holds nothing else, until ticket 13 adds the answer options (Q58). A prompt option of a later ticket goes in the preset the same way.
- The store and the active preset id are device settings.

**The Prompts tab.**

- The preset select at the top, with duplicate, rename and delete.
- A rail with the three prompts. Each opens in the prompt editor. The Default preset shows them read-only, with the reason and a way to duplicate.
- Each custom prompt has a reset to the default text.

**Chips.** The parts that the app reads back are chips in a small new chip vocabulary:

- the general-knowledge marker, in the answer and lookup prompts
- the lookup function's name, in the lookup prompt
- the pick limit and the reply-format rule, in the pick prompt

A prompt with no chip gets no injection: a custom answer prompt with no marker chip produces no flagged answers for covered questions.

**The help session** sends the active preset's texts. The language suffix and the user message stay built by the app (Q45).

The prompt editor's pop-outs must show above the modal. The Prompts docs section is written here.

Recommended model rationale: a new preset store beside an existing one, a new chip vocabulary, and the editor in a second dialog.

## Acceptance criteria

- [ ] The Default preset refuses edits, rename and delete.
- [ ] A custom preset's three texts reach the answer request, the pick request and the lookup request.
- [ ] With the Default preset, the request bodies equal those of ticket 05.
- [ ] Each chip resolves to the text the constant held; a text with no chip sends none.
- [ ] Reset returns a prompt to the default text; delete of the active preset selects Default.
- [ ] A change of the gameplay prompt preset does not change the help preset.
- [ ] Pure tests cover the store: duplicate, edit, rename, delete, reset, a bad stored value.
- [ ] A changelog line is in In Progress.
- [ ] The four gates are green.
