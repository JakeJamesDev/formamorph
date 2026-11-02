# 01: One Run Order

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Prefactor. Writes still land last-write-wins here, so this ticket changes which write wins and nothing a script reads.

## What to build

The Scripts tab and the turn read one run order, so a row's place is where it runs. One Blueprint row runs for all its owners back to back at the row's place. Library entities' scripts run after the list, in pick order, ignoring any `order`. World Tools stay first. Timings are listed At Game Start, Before the AI, During AI Output, After the AI, When a Trait Switches, in the tab and every menu.

Rulings: Q8, Q9, Q10, Q18, Q19.

## Acceptance criteria

- [x] One function gives the run order, and the Scripts tab and the turn both call it. (`inRowOrder` in `scripts.ts`; the tab calls it in `scriptsByTiming`, the turn through `runRowKeys` and `rowedUnits`)
- [x] A test through `runStatCodeTurn` proves one Blueprint script runs for all its owners back to back at its row's place, with and without an `order`. (`statCodeTurn.runOrder.test.ts`: one Blueprint row back to back, with and without `order`)
- [x] A test proves a library entity's script runs after every row and ignores a stored `order`. (`statCodeTurn.runOrder.test.ts`: library entity script and its Hub link run last)
- [x] A script with no `order` keeps today's sort, and a new script goes to the bottom of its timing. (control test with no `rowOrder`; `scriptsTab` test: Add Script numbers the timing and takes the last place, per Q25)
- [x] `scriptsByTiming`, the Timing menu, Add Script, templates and Code Insert list timings in the Q18 order. (`worldScripts.test.ts` timing order and `WorldEditor.scriptsTab.test.tsx` DOM read; menus, templates and Code Insert read the same `SCRIPT_TIMINGS`)
- [x] The Formaquestion prompt text and the help tool's schema keep their current order, and a test proves their bytes don't change. (`helpSession.codeTest.test.ts` pins schema options and text; `helpCodeRider.test.ts` pins box order)
- [x] Each new guard fails when the old order returns. (library rule mutated and the library test went red; the no-`rowOrder` control gives the old result)
- [x] Scripts Guide's Run Order and the Scripts tab how-to describe this order, and a changelog fragment exists. (Scripts Guide Run Order and tab how-to; fragment `script-run-order-01.md`)

## Landed

**Not verified**
- Menus, templates and Code Insert list timings in the Q18 order by sharing `SCRIPT_TIMINGS`; no test reads each menu.
- The Formaquestion pins check the schema options, its text and the rider's box order, not a stored copy of the old bytes.
- The Test Bench and the help window's code test do not pass `rowOrder` yet, so they keep the old sort.

**For you**
- Add Script now numbers the rows of its timing (Q25). Look at the Scripts tab: add a script and read the **order** of its neighbors.
