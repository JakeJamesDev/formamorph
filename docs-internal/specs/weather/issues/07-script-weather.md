# 07: Script Weather

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Author scripts can read and set the World Weather. The spec covers this in Q12 and the Scripts section.

- **Member.** A world-level weather member on the script surface: read the World Weather; set it to Clear or an allowed kind. This widens the sandbox's exposure on purpose.
- **Writes.** A set lands at commit through the existing write path, at ticket 03's script hook point, saves with the turn and undoes with it. A set that changes the experienced weather fires a Weather Change.
- **Errors.** A kind outside the allowed list, or Weather off, stops the script with an error that names it.
- **Docs.** The scripting reference wiki page describes the member.

## Acceptance criteria

- [x] Script-runner tests cover a read, a set to each allowed kind, the out-of-list error, the Weather-off error and undo. Each guard bites when its bug returns. (`statCodeExecutor.weather.test.ts`; the commit override, nightfall, allowed-list and Weather-off guards were reinstated one by one and each went red. Undo is the saved turn weather from ticket 03; the runner test only proves a run leaves its state untouched.)
- [ ] A script set during a turn reaches the Turn Commit and fires a Weather Change, and a later Weather Condition read sees it. (`weatherPass.test.ts` "a script weather set in the Turn Commit" covers the commit and the change; the Weather Condition read is unverified.)
- [x] Changelog fragment written. (`docs-internal/changelog.d/weather-07.md`)

## Landed

**Not verified**
- A later Weather Condition read of a script set: ticket 06 had not landed. The condition reads the Turn Commit's weather, which now holds the set.
- The view's wiring of `world.weather` (state in, `worldWrites.weather` out) has no GameViewer test.
- A rewind past a script set restoring the old weather is not tested here; it rests on ticket 03's saved turn weather.

**For you**
- Script `world.weather = "storm"` in an After the AI script in a world with Weather on, and watch the weather effect play.
- Script `world.weather = "brightSun"` in a late evening turn: it should end Clear with no effect.
- The kind words are `"clear"`, `"rain"`, `"snow"`, `"storm"`, `"brightSun"`, and `world.weather` reads `null` with Weather off. The spec names neither; say if you want other words.
