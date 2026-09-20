# 06: E2E: A Tied Announce

Status: ready-for-agent
Blocked by: 01, 02, 03, 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Contest Ties](../spec.md)

**What to build:** The existing contest journey in the Playwright suite announces one tie and proves that players see it. An admin places two worlds, sets **Tie With Above** on the second, and announces. The test then asserts the podium band, a card badge on each tied world, and the contest bar's count line. The suite runs outside the four gates.

- [ ] The journey announces a podium with two 1st-place worlds through the dialog
- [ ] The band shows both worlds with gold plates, in publish-time order
- [ ] Each tied world's card shows the 1st-place badge
- [ ] The contest bar reads "2 worlds tied for 1st"
- [ ] The journey still passes for a podium with no ties
- [ ] `npm run test:e2e` result and run time stated; four gates green
