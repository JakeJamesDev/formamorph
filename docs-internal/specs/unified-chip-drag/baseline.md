# Existing Chip Interaction Baseline

Characterized against the real World Editor and Settings → Prompts production screens before and during ticket 01.

## Supported Destinations

| Source | Supported destination | Operation |
| --- | --- | --- |
| World Editor placeholder palette | Any eligible, mounted chip field registered in the current detail panel | Copy with a fresh placement id, including an unfocused or empty field |
| World Editor placeholder palette click | The eligible field that most recently held the caret | Copy with a fresh placement id at that caret |
| Settings prompt toolbar click | Its own prompt field | Copy the selected prompt-variable form at that field's caret |
| Existing Placeholder Chip | A caret in the same field | Move the existing token and preserve its placement id, mode, reference, and path |
| Existing prompt-variable chip | A caret in the same field | Move the exact token, including variant and conditional prepend/append text |

Placed chips do not move between fields or editors. Placeholder and prompt-variable families do not accept each other's payloads.

## Reproduced Baseline Flaw

| Screen | Gesture | Expected | Actual before ticket 01 |
| --- | --- | --- | --- |
| World Editor | Focus a chip field, then drag a placeholder palette chip to another caret in that field | One fresh placement at the drop caret | Mouse-down inserted at the old caret and replaced the palette source before `dragstart`, so no drag began |

No other independently reproduced baseline flaw blocked the ticket 01 integrity criteria. Later interaction improvements remain outside this preparatory refactor.
