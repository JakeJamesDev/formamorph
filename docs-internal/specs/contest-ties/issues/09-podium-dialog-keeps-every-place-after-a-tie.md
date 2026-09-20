# 09: Podium Dialog Keeps Every Place After a Tie

Status: ready-for-human
Status note: the live 1, 1, 2 E2E run is open; the local server had no running contest, so both contest tests skipped (24 s)
Base: 000ba0ef
Blocked by: 04, 05, 06
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Contest Ties](../spec.md)

**What to build:** In the Podium dialog, a tie no longer removes a place. Tickets 04 and 05 built competition ranking (1, 1, 3). The user then decided that staff, not a ranking rule, choose how many winners a contest has. The place-derivation helper changes to dense ranking: an untied row takes the place of the row above plus 1, and a tied row shares it. Two worlds tied for 1st are followed by 2nd place, then 3rd.

A click on an unplaced entry is still never refused. It appends untied while the last row is below 3rd place, and it joins tied with the last row when that row already holds 3rd. The toggle refuses only when switching a tie off would push a row past 3rd place. The removal rule, the run order by publish time, and the step-down click from ticket 05 stay as built; check each against the new derivation. The example table in the spec under "Ranking rule" replaces the old one on the client side too.

The dev event sample and any fixture that shows 1, 1, 3 change to a podium with no gap. The E2E journey from ticket 06 announces 1, 1 only; extend it to 1, 1, 2 where the seed allows, so one run proves a shared place and a sole place. A live save of 1, 1, 2 needs ticket 08 on the server; the component tests mock the service.

- [x] The derivation helper passes the spec's new example table; `1,1,3` cannot be built
- [x] Two tied rows then an untied row derive 1, 1, 2; a further untied row derives 3; a further click joins 3rd place tied
- [x] Switching off a tie is refused only when a row would pass 3rd place
- [x] Removal, run order, and the step-down click still hold under the new derivation, each with a test
- [x] Edit mode opens a published `1,1,2,3` podium with its ties intact
- [x] The dev event sample and fixtures hold no gap
- [ ] The E2E journey announces 1, 1, 2 where the seed allows, and asserts the silver badge; `npm run test:e2e` result and run time stated
- [x] Dialog copy that describes a skipped place is corrected, following the help-copy pattern
- [x] Each changed guard is proven to fail when its rule is removed
- [x] Changelog In-Progress entry corrected, not duplicated; four gates green, test run time stated
