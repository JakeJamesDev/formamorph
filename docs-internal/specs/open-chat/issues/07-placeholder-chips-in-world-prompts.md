# 07: Placeholder Chips In World Custom Prompts

Status: ready-for-human
Base: 804ae5f3
Status note: direction approved and the three open decisions ruled by the user on 2026-09-21; see Comments
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

- [x] A placeholder chip in a world narration prompt resolves in the sent request, with a trait pin applied, checked by a test through `buildNarrationPrompt` or its caller seam
- [x] The same holds for the choices and stats prompts, or the ruling on decision 2 narrows this
- [x] A custom prompt that the player declined sends no world text, and the preset renders as before
- [x] The **Custom Prompts** field shows a placeholder chip as a chip, inserts one, and round-trips the stored text byte for byte
- [x] Request Anatomy labels the resolved value as placeholder output, not as authored prose
- [x] The prompt preview in the editor shows the resolved value
- [x] World search finds and replaces inside custom prompts without breaking a chip (`chipCapable`)
- [x] The Test Bench placeholder scan and the placeholder usage list count chips in custom prompts, so a delete warns
- [x] Each new guard fails when its bug returns, per the test bar
- [x] One Changelog In-Progress entry
- [x] Four gates green

## Comments

**2026-09-21, rulings from the user.** The spec session was not running, so the three open decisions went to the user.

1. Palette: the field keeps its prompt-variable toolbar and gains the `{` trigger.
2. Scope: all three kinds.
3. Unique chips: both modes are allowed. This overrules the recommendation. A Unique chip in a custom prompt rolls one time per placement, is primed with the rest of the world text, and shows its letter.

**2026-09-21, how it is built.**

- The seam next to `resolveWorldPrompt` is `worldPromptChipValues`. It keys each placeholder chip in the applied custom prompts to its resolved text. GameViewer spreads those values into the shared context values, so narration, choices, stats and the standalone re-rolls render them with no new parameter. A declined world gives no values, so a preset renders as before.
- The template render splits its text at placeholder chips. A chip with a value renders it under the new `placeholder` anatomy label. A chip with no value stays the text it is.
- `overviewTexts` is the one list of overview fields that hold chips, custom prompts included. Roll priming, the Test Bench chip owners, and the placement letters all read it.
- The Player Name marker (`{{user}}`) is left out of custom prompts. It reads its sentence position from the text around it, and a per-chip value cannot carry that. The `{` menu does not offer it there. A prompt names the player with the Persona prompt variable.
- The editor field is `PlaceholderField` with a `promptChips` option, over `worldPromptVocabulary`. The Values tab, the reroll and the pin stops come with it.

**Not covered by a test.** The one-line GameViewer wiring has no unit test, because GameViewer has no harness at that seam. The live check covered the editor side only. A playthrough with a tone trait switched on is the remaining check. Ticket 03 ships the first prompt that needs it.

**Seen, not fixed.**

- The Test Bench Opening tab builds its first prompt from the shipped narration prompt, not from the custom prompt of the world. That predates this ticket.
- The player-facing custom prompt viewer (`PromptDiff`, opened from the world details window) draws a placeholder chip as its raw `{{ph:…}}` token. Its word diff shields prompt tokens only, so it can split a placeholder token. This shows once a world ships a chip in a custom prompt, which ticket 03 does.
- A preset that holds the exact token of an applied world prompt resolves it. A token carries a unique placement id, so this needs a player to copy the world prompt into their preset.

**2026-09-21, closing review.** Folded in: the Player Name marker left out (it capitalized in the middle of a sentence), a whole-token check for the anatomy label, one `overviewTexts` list in place of three edits in step, one shared two-family parser, and clearer names in `worldPromptVocabulary`.
