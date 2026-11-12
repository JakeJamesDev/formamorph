# Spec: Clock Pass Anchors

Status: ready-for-agent
Spec session: clock-pass-anchors — spec

The clock pass answers through a response schema that can name a time of day the scene runs until ("until dawn"), and code turns that into the turn's hours from the story clock. Probe evidence: `testing/baseline/harness/time-delta-probe.cli.ts`.

## Problem Statement

With the AI clock on, a player's story clock jumps by amounts that do not match the scene. The worst cases:

- A scene that runs until a time of day ("you sleep until dawn", "they wait for nightfall", "the next morning") gets the same hours whatever time it started. The clock pass never sees the clock, so it guesses. Measured on the shipped prompt: 13% of anchored cases right on the cloud model, 38% on MeroMero 31B.
- A plain night's sleep reads as a full day on the cloud model.
- A reply the parser cannot read ("Few minutes", a bare "h", leaked thinking) falls back to the flat hour. On short conversations the cloud model does this on about one reply in five, so a two-line exchange costs an hour.
- "1 night" reads as one hour.

## Solution

The clock pass asks for three fields instead of free text: whether the scene runs until a time of day, a unit, and a count. Code turns a named time of day into hours from the story clock at the start of the turn, so the model never sees the clock and never does clock arithmetic. When no schema can be sent, the pass asks for the same answer as text: a count and its unit, or "until" and a time of day.

The player sees a clock that lands where the scene ends: a sleep until dawn begun at 21:00 costs nine hours, the same sleep begun at 02:00 costs four.

## Rulings

- **Q1.** Do not give the clock pass the current time. Probed: a start-time line made anchored cases worse on the cloud model (13% shipped, 13% as a daypart, 1% as a 24-hour clock). The model does not subtract.
- **Q2.** The model names the anchor; code does the arithmetic.
- **Q3.** The pass uses a response schema where the endpoint takes one.
- **Q4.** Test seams: the turn commit, from a raw reply to the turn's hours (parse, anchor math and guard together); the pass record, for the request shape (schema attached, text fallback present); the probe, for model numbers.
- **Q5.** Without a schema, the text reply is a count and its unit, or "until" and a time of day, resolved by the same anchor math.
- **Q6.** Ticket 01 reports cloud numbers (text request vs the shipped control) and has no pass bar. The spec's bar applies at ticket 02, which also carries the MeroMero run.
- **Q7.** The probe's control is the shipped clock request read from a fixed ref, scored the old way. The test arm is the app's real request, parse and commit math, bundled, with no copies in the harness. The spike's arms are removed; git history keeps them.
- **Q8.** The text reply-format wording is the implementer's, measured by the probe. If it scores below the spike's anchor arm on cloud (74% main, 75% anchored), use the spike's anchor sentence as written.
- **Q9.** On a custom calendar, a day is `hoursPerDay` for the day carry and the guard: the guard fires when the anchor lands more than 20/24 of a day ahead and the count is under one calendar day. A counted "N days" with no anchor stays N × 24 hours, as today.
- **Q10.** An anchor and any count in the same reply form one reading. "until dawn" alone has no count, so neither the carry nor the guard applies.
- **Q11.** Anchor math on the opening turn uses the calendar with the seeded opening hour merged in. The stat-code clock frame that drops `hoursPerDay` on the opening turn is named in the Landed section, not fixed here.

## User Stories

1. As a player, I want a sleep until dawn to end the clock at dawn, so that the next scene's daypart matches the story.
2. As a player, I want the same "until dawn" to cost fewer hours when I lay down after midnight, so that time follows when the scene started.
3. As a player, I want waiting for nightfall to end the clock at nightfall, so that night scenes open at night.
4. As a player, I want working until noon to end the clock at noon, so that the afternoon follows.
5. As a player, I want "I'll meet you tomorrow morning" to carry the clock to the next morning, so that the meeting happens on the right day.
6. As a player, I want a multi-day journey that arrives in the morning to count its days and land in the morning, so that both the length and the time of day are right.
7. As a player, I want a short conversation to cost minutes, so that a talky session does not burn whole hours.
8. As a player, I want a reply the model garbles to cost as little as possible, so that one bad answer does not jump the clock.
9. As a player, I want a stated length ("three weeks pass", "ten minutes later") to be used as stated, so that timeskips land exactly.
10. As a player, I want a night's sleep to cost a night, not a full day, so that I wake in the morning of the next day.
11. As a player, I want lying down to sleep, with the narration stopping there, to cost almost nothing, so that the night passes in the turn that actually sleeps.
12. As a player using native reasoning, I want the clock pass to still understand "until dawn", so that turning reasoning on does not make the clock worse.
13. As a player on an endpoint that refuses response schemas, I want the clock pass to fall back to text and keep working, so that my endpoint choice does not break the clock.
14. As a player in a world with a custom calendar, I want "until dawn" to land at that calendar's dawn, so that non-24-hour days stay consistent with the daypart conditions.
15. As a player on the opening turn, I want an anchored first scene to measure from the opening hour the game just set, so that the story's first hours are right.
16. As a player who edited the clock prompt in Settings, I want my judgment rules kept, so that my edits still apply with the new reply format.
17. As a player with the AI clock off, I want nothing to change, so that Time Per Turn still applies.
18. As a world author, I want the clock's daypart to match what my scene describes, so that Daypart Conditions on traits and images fire at the right times.
19. As a developer, I want the clock pass's request in the prompt diff viewer and the AI context view like any other pass, so that I can inspect what was sent.
20. As a developer, I want the probe to keep scoring the shipped request, so that later prompt changes come with numbers.

## Implementation Decisions

- **Reply shape.** The schema is an object with three required keys, in this order: `lasts_until` (the anchor names plus `none`), `unit` (`minutes`, `hours`, `days`, `weeks`), `count` (integer, at least 0). Key order is part of the decision: the anchor is decided first, and the unit is chosen before the number (v1 put the count first and answered 0 too often). From the probe (schema v2):

  ```json
  { "lasts_until": "none" | "dawn" | "morning" | "noon" | "afternoon" | "evening" | "nightfall" | "midnight",
    "unit": "minutes" | "hours" | "days" | "weeks",
    "count": <integer ≥ 0> }
  ```

- **Anchors are fractions of the day,** like dayparts, so a custom calendar divides the same way. Dawn, morning, afternoon and evening reuse the daypart starts; noon is half the day, nightfall is the start of night, midnight is the end of the day.
- **Anchor math** lives with the story clock module. Given the clock at the turn's start, the calendar, the anchor and the counted hours:
  - the hours run forward to the next occurrence of the anchor; an anchor equal to the start time means a full day;
  - when the count is one day or more, the whole days beyond the first are added (a four-day journey reaching a morning; "the next morning" with a count of one day adds nothing);
  - **guard:** when the anchor lands more than 20 of 24 hours ahead and the count is under a day, the count wins (the model named the time it already is). Probed: it rescued a dialogue "Morning." and "Quiet tonight", and broke no case.
- **No anchor:** the turn costs count × unit. An unreadable reply still resolves to the flat hour, as today.
- **The pass answers a reading, not hours.** The clock pass's parsed answer becomes the anchor, unit and count; the turn commit resolves it to hours, because only the commit holds the clock at the turn's start and the calendar (including the opening hour seeded the same turn).
- **Request shape follows the Inventory pass.** The editable clock prompt keeps the judgment rules; a reply-format block appended to the user message describes the fields (a schema format for the schema request, a text format for the fallback), shown as its own run in the request anatomy. The request carries the schema and a text fallback, and a clock text-pass setting skips the schema when the endpoint does not take one, like the inventory and entity-location passes.
- **Default prompt text** changes to drop the reply-format sentences now carried by the format blocks. Every wording change ships with probe numbers on the cloud model and MeroMero.
- **Text parsing** reads "until <anchor>" first, then a count and unit as today. "1 night" stays out of scope for the parser (see Out of Scope).
- **Save shape:** the turn still stores its measured hours. No change to world or save `.json`.
- **Sampler:** the clock pass keeps its temperature 0 pin. The token cap rises to fit the JSON reply.

## Testing Decisions

- A good test feeds what the model would send and asserts the hours the player's clock moves. It never asserts the prompt text or the private parse shape.
- **Turn commit (main seam):** raw schema replies and raw text replies, with a start time and calendar, give the turn's hours. Cover: each anchor from a start before and after it; an anchor equal to the start; the day carry (journey, next morning); the 20h guard firing and not firing; a stated count; `none` with a count; a malformed reply giving the flat hour; a custom-length calendar; the opening turn measuring from the seeded opening hour. Prior art: the computeTurnCommit tests that feed `parseResponse` a raw reply.
- **Pass record:** the request carries the schema and a text fallback; with the text-pass setting on it carries the text format alone; the reply-format block is its own anatomy run. Prior art: the inventory and stat pass request tests in the turnPasses tests.
- **Probe:** run the time-delta probe with the shipped request as the in-batch control, on both case files, cloud (12 runs) and MeroMero (3 runs). The probe must score the app's real parser and anchor math, not its own copies. Bar from the spike: cloud main set at least 87%, dialogue set at least 65%; MeroMero 100% on both.
- Prove each guard bites by reverting it and watching its test fail.

## Out of Scope

- A guard against an anchor far above a non-zero count. Prompt rewording (v3, v4) only moved failures around, and the remaining cloud misfires are on dialogue set at night ("tonight" read as nightfall). It is a candidate follow-up; MeroMero never misfires.
- Teaching the text parser that "night" is a unit.
- Showing the anchor to the player anywhere.
- The opening-time pass. It is unchanged.
- Hosted-model specifics. The schema goes through the shared request transport like the other schema passes.

## Further Notes

Probe results, 2026-11-12. Cloud = the default endpoint; MeroMero = `g4-meromero-v2-31b-i1`.

| Arm | Cloud main | Cloud dialogue | MeroMero main | MeroMero dialogue |
|---|---|---|---|---|
| Shipped prompt | 53–58% | 39–50% | 74% | 100% |
| Anchor text replies | 74% | — | 95% | — |
| Schema v2 + 20h guard | 87–89% | 65–70% | 100% | 100% |

- Before this spike, the probe never inserted the action or the narration, so time-delta numbers from before 2026-11-12 are void.
- Remaining cloud misses for schema v2: a walk across town answered `minutes, 0`; "three weeks pass" answered `days, 3`; a dialogue walk mentioning "tonight" answered `nightfall`.
