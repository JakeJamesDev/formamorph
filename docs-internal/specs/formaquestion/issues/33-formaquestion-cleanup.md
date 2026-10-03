# 33: Formaquestion cleanup

Status: done
Base: 6c238e4a
Blocked by: 32, 34, 35, 36
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A refactor with no behavior change, from the effort review's standards findings (Q56). Every existing test passes unchanged.

- **Production code reads a dev list.** The surface registry tells screens from dialogs by reading the dev-route views. Give the registry its own source of which places are screens, so production behavior does not follow the dev-route list.
- **One doc target.** Two types describe a page plus anchor, one with the anchor required and one with it optional. The `page#anchor` id string is built in five places. Use one type and one helper that builds the id.
- **One surface-to-section path.** The surface hint re-implements the surface help lookup. The hint calls the shared lookup.
- **One open-section update.** The Guide body and the window build the same "open this section" state change. Move it next to the tab state and call it from both.
- **One drag hook.** The window and the edge tab repeat the same pointer-capture, track, save-on-release code. Extract a hook both use.
- **Shared probe helpers.** The five help probe harnesses (ticket 26's `help-baseline.cli.ts` is the fifth) copy the same snapshot literal and the same percent, mean and fact-share helpers. Move them to one harness module.
- **Names.** Rename `askHelpTicket22` after what it does. Remove the `hidden = suspended` alias and the redundant `guide &&` check after the early return.
- **Copy.** The e2e skip message says "phone"; it says "mobile".
- **Comments.** Trim the multi-line comments on the window motion, window box and edge tab to one line each.

Recommended model rationale: a wide but shallow refactor across the effort's modules.

## Acceptance criteria

- [ ] The surface registry imports nothing from the dev routes
- [ ] One doc-target type and one id helper; no other site builds the `page#anchor` string
- [ ] The surface hint uses the shared surface help lookup
- [ ] The open-section update and the drag code each exist once
- [ ] The help probes share one helper module, and each still runs
- [ ] No test changed its assertions
- [ ] Four gates green
