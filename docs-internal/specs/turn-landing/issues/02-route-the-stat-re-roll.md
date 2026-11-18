# 02: Route The Stat Re-Roll Through The Turn Landing

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The stat re-roll lands through the Turn Landing as its second mode, and a re-roll gives exactly the results it gives today. This is a prefactor: no player-visible change.

- The stat re-roll mode runs the same order as the live mode over the saved turn. The module names each step the mode skips: the code move, the clock advance, discoveries, follower placement and the move offer clear (spec, Implementation Decisions).
- Every other difference between the two modes that exists today stays, as a named mode difference in the module with a one-line comment that cites its ruling (Q9 to Q16, Q18). Tickets 03 and 05 to 10 each remove one.
- The reset to pre-turn before the replay, the replay itself and the restore on Stop stay in the game view (spec, Implementation Decisions).
- The game view holds no second copy of the landing order after this ticket.

## Acceptance criteria

- [ ] The stat re-roll's landing runs through the Turn Landing; its hand-kept copy of the order is gone from the game view.
- [ ] An interface test asserts the re-roll order and that each skipped step makes no port call.
- [ ] A parity test lands one commit in both modes and compares the port calls. Each remaining difference is asserted by name, so removing one in a later ticket fails this test until the assertion is updated.
- [ ] The named mode differences in the module match the spec's fix list one to one: Q10, Q11, Q12, Q13, Q14 with Q18, Q16. A difference found that the spec does not list goes to the spec session before the first edit past it.
- [ ] No existing test expectation changed. Any that had to change is listed in the Landed section as a finding.
- [ ] World and save `.json` shape unchanged.
- [ ] No changelog fragment: nothing a player can see changed.

For you: re-roll the stats of a turn in a world with scripts and an Inventory pass, twice, and check the stat changes and bars behave as before.
