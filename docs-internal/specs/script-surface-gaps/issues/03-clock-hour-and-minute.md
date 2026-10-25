# 03: Clock Hour And Minute

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a small read built on the existing clock resolver, with one rounding rule to get right.

## What to build

`clock` and `clock.previous` gain `hour` and `minute` (Q3). Both derive from one rounded minute through the clock resolver the panel's stamp uses, so `minute` never reads 60 and `day`, `daypart`, `hour` and `minute` agree with the shown clock. The hour range is the calendar's hours per day. The opening turn reads the default start hour until the opening-time pass answers. Cards, the Variable menu and the Scripts guide cover both fields.

Spec: Q3, stories 13–15.

## Acceptance criteria

- [ ] A script at 21:59.7 story time reads `hour` 22 and `minute` 0, with `day` and `daypart` matching the panel's clock
- [ ] `clock.previous.hour` and `.minute` read the turn's start
- [ ] A `clock.advance` call moves `hour` and `minute` for the rest of the run, as it moves the other clock fields
- [ ] Hover cards, the Variable menu and the Scripts guide list `hour` and `minute`

## Blocked by

- None (can start immediately)
