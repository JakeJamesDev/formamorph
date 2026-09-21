# 07: Placeholder Chips In World Custom Prompts

Status: needs-triage
Status note: direction approved by the user on 2026-09-21; the open decisions below need a ruling before an agent starts
Blocked by: none
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## Why

Ticket 03 needs the Open Chat narration prompt to read the four tone placeholders as chips. The engine cannot do that today:

- The turn pipeline renders the narration template against the prompt-chip values only. It resolves placeholders in chip values, never in the template text. A `{{ph:…}}` chip typed in a custom prompt reaches the model raw.
- The **Custom Prompts** field in the World Editor takes one chip vocabulary, the prompt chips. A placeholder chip shows there as plain text.
- World search marks the custom prompts `chipCapable: false`, and the Test Bench placeholder scan does not read them.

Proof, 2026-09-21: a throwaway test sent a template with one tone chip typed in the text and the same chip inside `<WORLD DESCRIPTION>`. The typed chip came out raw. The world description chip came out resolved.

## What to build

A world custom prompt (narration, choices, stats) can hold placeholder chips. Play resolves them with the rolls and pins of the playthrough, the same as every other authored text. The World Editor shows them as chips in the **Custom Prompts** field and lets the author insert them.

The preset of the player never holds placeholder chips. Only world text does, so resolution applies to the custom prompt of the world only.

No world field is added or changed. The export shape stays the same.

## Open decisions

1. **Palette.** Recommended: the field keeps its prompt-chip toolbar and gains the `{` trigger that placeholder fields use. One field, two chip families, two ways in.
2. **Scope.** Recommended: all three kinds, through one seam next to `resolveWorldPrompt`, so ticket 04 can use it too.
3. **Unique chips.** Recommended: World-mode chips only in custom prompts, since a prompt is sent every turn and a per-placement roll has no meaning there.

## Acceptance criteria

- [ ] A placeholder chip in a world narration prompt resolves in the sent request, with a trait pin applied, checked by a test through `buildNarrationPrompt` or its caller seam
- [ ] The same holds for the choices and stats prompts, or the ruling on decision 2 narrows this
- [ ] A custom prompt that the player declined sends no world text, and the preset renders as before
- [ ] The **Custom Prompts** field shows a placeholder chip as a chip, inserts one, and round-trips the stored text byte for byte
- [ ] Request Anatomy labels the resolved value as placeholder output, not as authored prose
- [ ] The prompt preview in the editor shows the resolved value
- [ ] World search finds and replaces inside custom prompts without breaking a chip (`chipCapable`)
- [ ] The Test Bench placeholder scan and the placeholder usage list count chips in custom prompts, so a delete warns
- [ ] Each new guard fails when its bug returns, per the test bar
- [ ] One Changelog In-Progress entry
- [ ] Four gates green

## Comments
