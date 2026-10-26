# 03: Clock Hour And Minute

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a small read built on the existing clock resolver, with one rounding rule to get right.

## What to build

`clock` and `clock.previous` gain `hour` and `minute` (Q3). Both derive from one rounded minute through the clock resolver the panel's stamp uses, so `minute` never reads 60 and `day`, `daypart`, `hour` and `minute` agree with the shown clock. The hour range is the calendar's hours per day. The opening turn reads the default start hour until the opening-time pass answers. Cards, the Variable menu and the Scripts guide cover both fields.

Spec: Q3, stories 13–15.

## Acceptance criteria

- [x] A script at 21:59.7 story time reads `hour` 22 and `minute` 0, with `day` and `daypart` matching the panel's clock (`statCodeExecutor.clockHourMinute.test.ts` "reads 21:59.7 as hour 22, minute 0"; `gameClock.clockReading.test.ts` "agrees with the stamp the panel prints")
- [x] `clock.previous.hour` and `.minute` read the turn's start (`statCodeExecutor.clockHourMinute.test.ts` "reads the turn start on clock.previous")
- [x] A `clock.advance` call leaves `hour` and `minute` at the run-start reading, as it leaves the other clock fields (Q41; `statCodeExecutor.worldWrites.test.ts` "keeps hour and minute at the run-start reading after an advance")
- [x] Hover cards, the Variable menu and the Scripts guide list `hour` and `minute` (`codeCards.test.ts` clock card, `statCodeAnalysis.test.ts` clock completions; Variable menu and tool menu read the same surface list; `docs/ScriptsGuide.md` table)

## Landed

**Not verified**
- Rendered Variable menu and hover card in the browser: covered by the shared surface list and its tests only.

**For you**
- Open the Variable menu in a script box: `clock` and `clock.previous` list `hour` and `minute`.

## Blocked by

- None (can start immediately)
