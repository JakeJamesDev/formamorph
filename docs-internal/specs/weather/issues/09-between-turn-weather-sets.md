# 09: Between-Turn Weather Sets

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A weather set from a script that runs between turns takes effect. The spec covers this in the Scripts section: "A set lands at commit through the existing write path, saves with the turn and undoes with it."

- **Gap.** Item and switch scripts get `world.weather`, and the script reads its own set back. The between-turn landing (`landOnLatestTurn` in the game view) never applies `writes.weather`. The weather stays the same, nothing is saved and no effect plays.
- **Landing.** A between-turn set lands on the latest turn like the other world writes: the World Weather changes, the latest turn's snapshot records it, and the Weather Change helper reports it so the foreground can fire. The nightfall rule applies to the result.
- **During a turn.** A set from a run that ends while a turn runs is held and lands with that turn's commit, through the existing held-writes path.

## Acceptance criteria

- [x] An item script that sets Storm between turns changes the World Weather, and the latest turn's snapshot records Storm. (`GameViewer.weatherBetweenTurns.test.tsx`, first test; driven by a switch script, which shares the landing path with item scripts)
- [x] The set reports a Weather Change that may fire foreground. (same test: `__fmDev.weatherChange()` reads rain → storm, foreground true)
- [x] A set held while a turn runs lands with that turn. (third test: Rain until the turn commits, then Storm, snapshot Storm)
- [x] Bright Sun set at night ends as Clear. (second test: Clear, snapshot omits weather, no foreground)
- [x] Each guard bites when its bug returns. (reinstated: no nightfall rule fails test 2; no snapshot patch fails all three; no hold fails test 3)
- [ ] Changelog: fold into the unreleased script weather entry if its text needs it. (a fragment adds its own entry; line 35 of `docs/Changelog.md` still says a set takes effect when the turn ends)

## Landed

**Not verified**
- Changelog fold-in: a ticket branch cannot edit `docs/Changelog.md`. Its line "A set takes effect when the turn ends" is now partly stale.
- Item scripts: the tests use a switch script. Item scripts call the same `landBetweenTurns`, but no test drives one.
- Weather off: the `weatherOn` guard has no test.
- The report-call guard (`reportWeather`) was not reinstated as a bug; the first two tests read the report.

**Gaps found by the review**
- A set that ends before any turn exists is dropped (`landOnLatestTurn` returns first).
- A held set lands after the turn's own landing, so one turn can report two Weather Changes.

**For you**
- Toggle a trait whose switch script sets Storm in a world with Weather on, between turns: the rain or storm effect should play at once.
