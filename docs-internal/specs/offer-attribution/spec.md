# Spec: Offer Attribution

Status: ready-for-agent
Spec session: offer-attribution — spec

Each Formamorph AI offer gets its own funnel counts, from shown to See Levels to Patreon to the finished checklist, so we can see which offer converts. Spans both repos: the client and FormamorphServer.

## Problem Statement

Three offers point players at Formamorph AI: the low-VRAM lead in AI setup, the Demo AI story card at turn 10, and the built-in engine story card at turn 10. Two more buttons open The Road too: the Demo AI notice and the locked-preset panel.

The funnel cannot tell them apart. Only the two cards send a "shown" step. The AI setup lead sends none. See Levels, Patreon Click and Checklist Finished are single totals fed by every entry point. We suspect the AI setup lead converts few players, but the data cannot confirm or refute it.

Until commit 38a786c23 the AI setup lead's See Levels click sent nothing at all.

## Solution

Every entry point that opens The Road reports under its own source. The three offers also report a "shown" step once per install. The Road remembers the source that opened it, so its Patreon click and finished checklist count under that source.

The staff Usage view shows one row per source, with a rate from each step to the step before it. Counts from older builds, which carry no source, get a row of their own.

## Rulings

| Q | Ruling |
|---|---|
| Q1 | Every entry point that opens The Road gets its own counts: the AI setup lead, the Demo AI card, the built-in engine card, the Demo AI notice and the locked-preset panel. No unlabeled See Levels remains in new builds. |
| Q2 | A source travels as part of the step name. The server's step list grows. The route, the limiter and the totals table do not change. |
| Q3 | The AI setup lead counts as shown once per install, the same as both cards. |
| Q4 | The Patreon click carries the source of the Road open it happened in. |
| Q5 | The AI setup lead's dead See Levels click is fixed on its own, before this effort (38a786c23). |
| Q6 | The server keeps accepting `offer_shown`, `see_levels` and `patreon_click` from v3.6.2 clients. The report shows them as an "Older Builds" row. New builds stop sending them. |
| Q7 | Step names are `<source>_<step>`. Sources: `setup`, `demo`, `engine`, `notice`, `locked`. Steps: `offer_shown`, `see_levels`, `patreon_click`, `checklist_finished`. `engine_offer_shown` is unshipped and already fits. |
| Q8 | The latest Road open owns its Patreon click and finished checklist. No source outlives the scene. |
| Q9 | Checklist Finished splits per source, the same as the Patreon click. |
| Q10 | The Demo AI notice and the locked-preset panel get no "shown" step. They show on every visit, so a shown count has no comparable rate. |
| Q11 | The Usage view shows a table: one row per source, columns Shown, See Levels, Patreon, Checklist, each with a rate to the step before. A last row holds the older-build totals. |
| Q13 | The locked-preset panel's See Levels button sends `locked_see_levels`. The earlier text said `locked` opens only the checklist; the panel has both buttons. Ticket 02 ruling. |
| Q14 | The Road sends no Patreon or Checklist step while it holds no source. Only the dev-router opens it that way; every real caller passes a source by type. Ticket 02 ruling. |
| Q15 | The table replaces the Offer Steps bars under the same heading. The empty text stays for a range where every count is zero. Ticket 03 ruling. |
| Q16 | A row's first valid step shows its count with no rate. Notice and locked show the empty value only in Shown. A step missing from the report counts 0. A rate over a zero base shows the empty value. Ticket 03 ruling. |
| Q17 | Cells read "count (rate)", the same as the bars did. Ticket 03 ruling. |
| Q12 | Tests use existing seams only: funnel POSTs counted per surface on the client, the server's funnel totals and Usage report tests, and the Usage tab test. |

## User Stories

1. As the owner, I want a count of installs that saw the AI setup lead, so that I can size its audience.
2. As the owner, I want a count of installs that clicked See Levels on the AI setup lead, so that I can see its click rate.
3. As the owner, I want a count of installs that clicked See Levels on the Demo AI card, so that I can see that card's click rate.
4. As the owner, I want a count of installs that clicked See Levels on the built-in engine card, so that I can see that card's click rate.
5. As the owner, I want See Levels clicks from the Demo AI notice counted apart, so that they do not inflate a card's rate.
6. As the owner, I want the locked-preset panel's clicks counted apart, so that players who already chose a preset do not blur the offer numbers.
7. As the owner, I want each Patreon click credited to the source that opened The Road, so that I can see which offer leads to a pledge attempt.
8. As the owner, I want each finished checklist credited to its source, so that I can see the deepest step per offer.
9. As the owner, I want the three offers' "shown" counts to use the same once-per-install rule, so that their rates compare directly.
10. As the owner, I want one table row per source with rates between steps, so that I can read the funnel without arithmetic.
11. As the owner, I want counts from older builds kept in their own row, so that history stays visible and does not pollute the split.
12. As a player on an older build, I want my client's funnel posts still accepted, so that nothing errors or retries on my side.
13. As a player, I want no new data about me sent, so that the funnel stays as private as before: a step name, with no header, body or credential.
14. As a player who opens The Road from two offers in one session, I want each open to report on its own, so that the counts stay honest.
15. As the owner, I want the server deployed before the client build, so that no new step is refused and lost.
16. As a developer, I want the source and step lists named once per repo, so that a typo cannot add or drop a row.
17. As a developer, I want the step names to follow one scheme, so that the Usage view can group them without a lookup table per name.

## Implementation Decisions

- **Sources and steps.** The client and the server each name the five sources and the four steps once. The full step list is the valid `<source>_<step>` pairs plus the legacy names. `checklist_finished` also shipped in v3.6.2, so it is legacy beside the three Q6 names. Valid pairs: `offer_shown` for `setup`, `demo` and `engine` only; `see_levels` for all five (Q13); `patreon_click` and `checklist_finished` for all five.
- **Once per device.** `sendFunnelStep` already sends each step once per device. A per-source name therefore counts installs per source, not clicks. A device that clicked See Levels in v3.6.2 counts again under its new source name. That is expected.
- **Road source.** Opening The Road takes a source with the start view. The Road scene store holds the source while the scene is open and clears it on close. The support checklist reads it for its Patreon and Checklist Finished steps. Every caller of the Road open passes a source. A missing source is a type error, not a fallback.
- **AI setup lead shown.** The lead sends `setup_offer_shown` the first time it renders on screen for an install. Its seen record lives beside the two cards' records in the first-time flow store.
- **Cards.** The Demo AI card sends `demo_offer_shown` in place of `offer_shown`. The built-in engine card keeps `engine_offer_shown`.
- **Server.** The step list grows to the new names and keeps the legacy names. The route, limiter, totals model and admin read do not change. The Usage report's offer rows follow the list.
- **Usage view.** The staff Usage view groups the offer rows by source into the Q11 table. Legacy names fill an "Older Builds" row: `offer_shown` under Shown, `see_levels` under See Levels, `patreon_click` under Patreon, `checklist_finished` under Checklist. A cell with no valid step shows the empty value.
- **Dev sample.** The dev usage sample produces the new names, so the dev-router view of the Usage tab shows the table.
- **Export shape.** No world or save shape changes.

## Testing Decisions

- A good test drives a surface the way a player does and counts the funnel POSTs by name. It never reads the store's internals.
- **Client.** Each surface sends its own names: the AI setup lead (shown once per install, See Levels), both cards, the Demo AI notice, the locked-preset panel, and The Road's Patreon and Checklist steps after opening from each source. One case opens The Road from one source, closes it, opens it from another, and checks that the Patreon click carries the second source. Prior art: `useDemoAIOffer.test.tsx`, `AiSetupGate.test.tsx`, `funnel.test.ts`.
- **Server.** Every new name is accepted and counted. The legacy names are still accepted. An unknown name is refused. The Usage report lists every step. Prior art: `funnelTotals.test.js`, `hostedAiUsageReport.test.js`.
- **Usage view.** The table groups rows by source, computes the rates and shows the Older Builds row. Prior art: `UsageTab.test.tsx`.
- Each guard is proven by reinstating its bug, for example by dropping the source from one caller.

## Out of Scope

- Pledge attribution. The funnel keeps no per-install link (first-time flow Q41), so "converted" means the Patreon click, not a confirmed pledge.
- Shown counts for the Demo AI notice and the locked-preset panel (Q10).
- First-touch attribution across Road opens (Q8).
- Any change to offer copy, placement or timing.

## Further Notes

- Deploy FormamorphServer first. A client build that ships before it loses each new step's one-time send for that install.
- The client and server lists must match. The client's `FunnelStep` type and the server's step list are the two places.
