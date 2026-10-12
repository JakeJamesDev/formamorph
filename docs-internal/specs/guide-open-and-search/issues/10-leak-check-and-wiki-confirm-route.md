# 10: Leak Check and Wiki Confirm Route

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Close the checks that ticket 08 and ticket 05 left open (Q40).

- **Leak check:** with each of these open below the help window, check whether a click or Escape in help closes it:
  - hover cards;
  - the chip typeahead (it sits above the layer at z-70, so check whether it also takes presses meant for help);
  - Base UI popups (tooltips and any Base UI popover).
  State the result for each. Fix any that leaks with the same guard as ticket 08, and keep the shielded-layer module import-free.
- **Wiki confirm dev route:** add a dev-router entry that opens the Open Wiki confirm, so it can be verified without a click path. Verify it in both themes.

Spec: Q23, Q29, Q40.

Recommended model rationale: dismiss-layer event order across Radix and Base UI in a layer with three known traps.

## Acceptance criteria

- [ ] A stated result for hover cards, the chip typeahead and Base UI popups, with how each was checked.
- [ ] Each leak found is fixed, with a test proven to bite.
- [ ] A dev route opens the wiki confirm; verified in both themes.
- [ ] Changelog fragment written if a fix is player-visible; four gates green.
