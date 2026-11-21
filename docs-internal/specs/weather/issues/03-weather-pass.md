# 03: Weather Pass

Status: done
Blocked by: 02, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The narration changes the weather, and the narrator stays consistent with it. The spec covers this in Q1, Q4, Q7, Q10, Q11, Q15, Q24 and the Weather Pass, Turn Commit and narrator sections.

- **Pass.** A new turn pass beside the clock pass, run every turn while Weather is on. Input: narration, current World Weather, allowed kinds, daylight. Bright Sun is not offered at night. Daylight comes from ticket 04's `isDaylight` helper; this ticket never builds its own. Output: "no change" or one offered kind, structured like the clock reading, with a text fallback. An answer outside the offered set reads as no change. Samplers pinned in the per-prompt samplers.
- **Page one.** On the opening turn the pass reads page one only when no weather was authored: ticket 02's `resolveStart` returns the weather as unset (null), which callers save as Clear today. The World Editor's Default Weather hint then gains the unset case (page one sets it), per the Writing Guide.
- **Turn Commit.** The commit carries the resulting World Weather in this order: pass answer, nightfall rule (Bright Sun → Clear when the turn ends at night), a hook point for script sets (ticket 07), final weather. This ticket owns that order.
- **Turn Landing.** Applies the weather through the effects port and reports a Weather Change when the experienced weather changes, with whether it may fire foreground: not on the opening turn, not from the nightfall rule, not into Clear or Shelter. The stat re-roll mode is a named skip. Each turn's history snapshot already records the World Weather (Q28), so the landing needs nothing extra for paging.
- **Narrator.** The scene context gets one weather line while Weather is on, and page one gets the resolved weather.
- **Probes.** The pass prompt and the narrator line ship with probe numbers on the cloud default, with in-batch controls, including metaphor, past-tense and reported-weather traps.
- **Docs.** The world settings wiki page says the narration drives weather within the allowed kinds.

## Acceptance criteria

- [ ] Turn Pipeline tests with a fake request adapter cover: no change, each kind, an out-of-set answer, Bright Sun offered only in daylight, nightfall from Bright Sun, a move into and out of Shelter, the opening turn and the stat re-roll skip. Each guard bites when its bug returns.
  - Everything but the stat re-roll skip: `src/lib/turnPipeline/weatherPass.test.ts` (19 cases), plus `weather.test.ts` and `weatherPass.test.ts` beside `src/lib/weather.ts`. Eleven guards were mutated back one at a time, and each turned its test red.
- [x] An authored start weather leaves the page-one Weather Pass out of the plan; an unset one includes it. See "the opening turn" in `weatherPass.test.ts`; the mutated `isDue` turned it red.
- [x] Probe results for the pass and the narrator line are recorded in the ticket's Landed section, with run counts per arm. They are below.
- [x] Changelog fragment written: `docs-internal/changelog.d/weather-03.md`.

## Landed

**Probes** (cloud default, runs interleaved per arm in one batch)

Weather Pass, `testing/baseline/harness/weather-pass-probe.cli.ts`, 12 runs per arm per case, 16 cases (6 change, 10 hold, 3 of them page-one reads):

| Arm | Change right | Hold right | Unreadable |
|---|---|---|---|
| schema (the production path) | 72/72 | 120/120 | 0/192 |
| text (an endpoint that refuses schemas) | 72/72 | 108/120 | 0/192 |
| text without the figure-of-speech line | 72/72 | 84/120 | 0/192 |

- Before the `shown` gate, on the same cases, all three arms scored metaphor 0/12 and reported weather 0/12. The trap line alone did nothing (the ablated arm matched).
- The text request still misses the metaphor case 12/12 ("yes - storm"). Only endpoints that refuse a schema send it.

Narrator weather line, `testing/baseline/harness/weather-narrator-probe.cli.ts`, 8 runs per arm per case. Control is Weather off, so no chip:

| Case | Check | Control | Chip |
|---|---|---|---|
| Rain, outdoors | shows rain | 1/8 | 7/8 |
| | contradicts rain | 4/8 | 0/8 |
| Snow, outdoors | shows snow | 0/8 | 8/8 |
| | contradicts snow | 1/8 | 0/8 |
| Storm, in talk | shows storm | 1/8 | 8/8 |
| | contradicts storm | 4/8 | 0/8 |
| Rain, Sheltered | rain falls on the player | 0/8 | 1/8 |
| Clear, outdoors (guard) | invents weather | 1/8 | 1/8 |

- Prompt cache: the Weather block starts at char 3275 of a 4907-char system prompt, after Current Location at 2932. A weather change keeps 343 more cached characters than a move does. It never shifts anything a move would not.

**Not verified**
- The stat re-roll skip has no test. `handleRegenerateStats` sits in `GameViewer.tsx`, which is too large to mount. The skip is a named comment there, and the turn-landing ticket 01 port is where it can be tested.
- The `GameViewer.tsx` wiring was read, not run: `changeLocation`, the landing's weather step, `turnWeather` and `chipWeather`. Its decisions sit in `landedWeatherChange`, `computeTurnCommit` and `weatherPass`, which are tested.
- The Default Weather hint was not looked at in the browser.

**For you**
- Play a few turns in an opted-in world, let a storm roll in, and check the narration keeps it.
- Settings → Prompts → Trackers has a new **Weather** prompt.
- The hosted server's prompt-type list (FormamorphServer `src/config/hostedAi.js`) lacks `weather`. Usage rows record its calls with no type until it is added there.
- The bundled Open Chat world's narration prompt gained the `<WEATHER>` chip. Its test requires every built-in chip, and the chip renders nothing while Weather is off.
