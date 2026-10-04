# 06: Reader piece

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

With the mascot on, a source name opens the guide reader beside the chat.

- Source names under an answer are links again in the minimal chrome.
- A click opens the reader as its own floating piece right of the column, showing the guide reader on that section, with its own close button. The window box widens by the reader's width while it shows.
- The reader piece moves with the window by the pill.

Spec: Q17, Q23; Implementation → Window.

Recommended model rationale: layout work on an existing reader with a clear contract.

## Acceptance criteria

- [ ] A source-name click opens the reader on that section; its close button closes it and the chat stays.
- [ ] The three pieces move together.
- [ ] Playwright: the reader opening from a source name beside the mascot and the column.
- [ ] The four gates are green.
