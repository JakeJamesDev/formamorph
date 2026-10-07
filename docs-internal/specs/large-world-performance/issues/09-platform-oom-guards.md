# 09: Platform Out-of-Memory Guards

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: two small platform changes: an Electron main-process listener and an Android manifest flag.

## What to build

Desktop and Android recover from memory exhaustion (Q21). Electron listens for the renderer process dying or becoming unresponsive, shows a native message, and reloads the window. Android sets the large-heap flag on the application so the WebView gets a higher memory ceiling. No persistent-storage request. One changelog fragment, Minor Fixed, 👤.

## Acceptance criteria

- [ ] Electron: a forced renderer crash shows the message and reloads the window.
- [ ] Electron: an unresponsive renderer shows the message with the choice to wait or reload.
- [ ] Android: the built manifest carries the large-heap flag.
- [ ] Four gates green; `desktop:dev` launches.
