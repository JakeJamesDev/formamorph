# Spec: Weekly Allowance

Status: ready-for-agent
Spec session: weekly-allowance — spec
Status note: Blocks the Formamorph AI release (Q20). Every budget and the math behind it live in the local hosted-tier note, never in this repo.

A Supporter's Formamorph AI allowance resets every week instead of every month, and an Allowance Ring beside Send shows how much is used and where it went. Designed in a grilling session on 2026-11-01 (rulings Q1–Q20). This spec replaces the monthly reset of the closed Formamorph AI spec (`docs-internal/specs/hosted-ai/spec.md`, its Q10).

Q7 and Q8 already landed: Send and Stop are one width at every screen size, in commit 0d740bf0d.

## Problem Statement

A Supporter can spend a whole month's allowance in a few days. They then can't play Formamorph AI for weeks. They often don't know how fast they spent it, because the only usage display is in AI settings.

When the allowance ends early, the player also can't tell why. A bug that makes one prompt spend too much stays hidden from the player and from us.

## Solution

The allowance resets every Monday at 00:00 UTC. A Supporter who runs out waits days, not weeks.

While Formamorph AI serves any prompt, a small ring sits between Help and Send and fills as the week's allowance is spent. Selecting it opens a popover with the percent used, about how many turns are left, the reset day and a breakdown of where this week's use went.

The breakdown shows seven groups by share of cost. Any single prompt with a large share gets its own row under its group, so a prompt that spends too much is visible.

## User Stories

1. As a Supporter, I want my allowance to reset every week, so that overspending never costs me most of a month.
2. As a Supporter, I want the reset at one fixed time each week, so that the rule is easy to remember.
3. As a Supporter, I want the reset shown in my local time, so that I don't have to convert from UTC.
4. As a Supporter who joins late in a week, I want the same reset time as everyone, so that there is one rule.
5. As a Supporter who reaches the end of the allowance, I want a message that names the reset day, so that I know when it comes back.
6. As a Supporter who reaches the end of the allowance, I want one click back to my last other preset, so that I can keep playing at once.
7. As a Supporter who upgrades mid-week, I want the new allowance at once, with my spend so far counted, so that the upgrade is instant and the rule stays simple.
8. As a Supporter in a turn that crosses the reset, I want the turn to finish, so that the reset never cuts narration.
9. As a Supporter, I want a ring beside Send that shows how much of the week I've used, so that I see it while I play.
10. As a Supporter on my own endpoint, I want no ring, so that the row holds nothing that doesn't apply to me.
11. As a Supporter with one prompt pinned to Formamorph AI, I want the ring, so that spending never goes unseen.
12. As a Supporter, I want the ring to hold still during a turn, so that it doesn't pull my eye from the narration.
13. As a Supporter, I want the ring to include the turn that just ended, so that the figure is current.
14. As a Supporter, I want the ring to change color at 75% and 90%, so that I notice before the allowance ends.
15. As a Supporter, I want one notice at 90%, so that a weekly cycle doesn't interrupt me twice a week.
16. As a Supporter, I want to select the ring and read the percent used, about how many turns are left and the reset day, so that I can plan a session without leaving the scene.
17. As a Supporter, I want the popover to show where this week's use went by percent, so that I can see what spends my allowance.
18. As a Supporter, I want shares that agree with the ring, so that the two displays never tell different stories.
19. As a Supporter, I want no dollar amounts, so that I read the allowance and not its price.
20. As a Supporter, I want Choices and Memory as their own rows, so that I can see what turning them off would save.
21. As a Supporter, I want a single prompt with a large share named under its group, so that I can report a prompt that looks wrong.
22. As a Supporter early in a new week, I want a clear empty state, so that I don't read an empty breakdown as a fault.
23. As a Supporter in AI settings, I want the same breakdown there, so that I can check it during setup.
24. As a Supporter on formamorph.ai, I want my profile page to show percent used and the weekly reset day, so that I can check it without the app.
25. As a Supporter on a mobile width, I want the focused input to expand over Help and the ring, so that they don't take typing room.
26. As a Supporter on a mobile width, I want Send visible while I type, so that I can send with one tap.
27. As a Supporter on a mobile width, I want Help and the ring back when I leave the input, so that I can still reach them.
28. As a Supporter on a desktop width, I want Help and the ring visible while I type, so that I can see my usage in the normal play loop.
29. As a Supporter when Formamorph AI is paused, I want the ring to stay and explain why, so that I don't think my allowance ended.
30. As a former Supporter whose pledge lapsed, I want the ring to explain the lock and link to Patreon, so that I know what changed.
31. As a player who uses the keyboard or a screen reader, I want the ring as a labeled button with the percent in its name, so that I can reach it and hear it.
32. As a player who never uses Formamorph AI, I want no ring and no new server traffic, so that nothing changes for me.
33. As an admin, I want a member's usage view to list every prompt's share with no threshold, so that I can diagnose one account's report.
34. As an admin, I want to set each tier's weekly budget in server settings, so that I can tune it with no deploy.
35. As an admin, I want to set the breakdown threshold in server settings, so that I can tune it from real shares with no release.
36. As the project, I want the budget to stay at the same worst-case share of Patreon income, so that the weekly reset doesn't change the economics.
37. As the project, I want the weekly reset in the first Formamorph AI release, so that no member ever has a monthly allowance taken away.
38. As the project, I want no prompt text stored with the prompt type, so that the usage table still holds metadata only.

## Implementation Decisions

**Weekly meter (server)**
- The budget period is the UTC week starting Monday 00:00. Every monthly reader moves to it: admission, the hosted state, the usage snapshot, the admin spend read and the `resetAt` value.
- There is no monthly meter left (Q1). The rest of the meter keeps its rules: the reservation, the overrun bound, tier changes at once, and turns admitted before a reset finishing after it.
- A tier's `budget` setting holds the weekly amount directly. There is no conversion in code. The admin panel labels it as weekly.
- Warning acknowledgments are keyed by week: a schema step renames the key column to `week`, holding the Monday as `YYYY-MM-DD`. Old monthly keys never match.
- The retention setting can't be set below 7 days. A stored lower value isn't rewritten; the next admin save is refused until it is fixed.
- The admin spend read keeps its response field names, and its `since` becomes the week start.
- The daily ceiling, the spend-versus-estimate report and the Supporter subject rules don't change.

**Prompt type on usage rows**
- The client sends each call's `AIRequestType` in a new request header on the proxy route. The header never goes upstream.
- A new nullable column on the usage table stores it. The server accepts only known values and stores null otherwise. It never refuses a call over this header.
- One shared list of prompt types is checked by a test in each repo, as the refusal codes are.

**Breakdown data**
- The hosted-state route gains `breakdown`: each prompt type's share of the subject's spend this week, as a percent with one decimal, with no dollar amount. A null type comes back as `other`. It also gains `breakdownThreshold`.
- `breakdownThreshold` is a server setting with a default of 10 (Q10).
- The `event: usage` payload doesn't change. The popover refetches the hosted state when it opens. A player with no Formamorph AI prompt never makes this read.
- The admin spend read for a subject gains the same per-type shares (Q11). Staff tools get no changelog entry.

**Breakdown rollup (client)**
- One pure module turns the shares into rows. Input: `breakdown` and `breakdownThreshold`. Output: ordered group rows, each with its nested prompt rows.
- Costs are the basis, never tokens (Q5).

| Group | Prompt types |
|---|---|
| Narration | `narration` |
| Planning | `thinking`, `director`, `character`, `storyboard` |
| Choices | `choices` |
| Stats and World Tracking | `statUpdates`, `locationChange`, `entityLocation`, `discoverEntity`, `timePassed`, `openingTime`, `sceneTags` |
| Inventory | `inventory` |
| Memory | `summary`, `milestoneSelect`, `diary` |
| Help and Editor | `help`, `descriptionSummary`, `descriptionBridge`, `imageTags` |

- Group names above are working names. Final labels follow the Writing Guide.
- A prompt at or above the threshold gets an indented row under its group, named as in AI settings (Q9). A group of one prompt never repeats itself as a nested row. The editor types have no AI settings row, so they get their own names here.
- `other` and unknown types form an Other row, shown only when above zero.
- Groups show whole percents and total 100, using largest-remainder rounding. A group with a zero share still shows, so the list keeps its shape.
- The rollup has one source of truth for the group of each type. A test fails when `AIRequestType` gains a type with no group.

**Allowance Ring**
- A new component between Help and Send, in every game layout (Q15). It is a button with an accessible name that holds the percent.
- It shows when any prompt in the active setup resolves to Formamorph AI, including a pinned pass (Q3). It uses the same per-prompt endpoint resolution as the Send tooltip.
- Its figure is a snapshot taken when a turn ends, committed or aborted (Q13), and refreshed by any fetch of the hosted state outside a turn. Mid-turn usage events still update the hosted session for its existing rules; the ring doesn't read them until the turn ends.
- It changes color at each value in `warnThresholds` (Q14). The toast fires only for the highest threshold.
- For a state with no usage figure (`paused`, `locked` and the app-derived states), the ring stays and shows no fill (Q19).
- The ring's look is a new visual pattern. It needs the user's approval before adoption, and it enters the Design System and its showcase with a dev route.

**Popover**
- Selecting the ring opens a popover above the input (Q4), holding the existing usage lines and the breakdown, or the existing state reason and actions where the state has them. At the end of the allowance it holds switch back and the Patreon link.
- It covers this week only (Q16), with an empty state when nothing is spent yet.
- One shared breakdown component serves the popover and AI settings (Q12). The site profile keeps percent and reset day, with no breakdown.

**Mobile input expansion**
- On mobile widths, the focused action input expands over Help and the ring, and Send stays visible (Q15, Q17). The input already tracks focus and collapses on blur; the same state drives this.
- The ring stays hidden while the input is expanded, even at 90% or above (Q18).
- Attach Images isn't part of this change.
- Desktop widths keep Help and the ring visible while typing.

**Copy and docs**
- Every monthly string becomes weekly: the state reason, the usage help line, the warning text, the server's refusal message, the site profile, help topics, and the wiki pages. The reset date format moves from a UTC calendar date to a local weekday and time ("Monday at 5:00 PM"), with no zone name. Fixed copy never names a weekday, because Monday 00:00 UTC falls on Sunday in the Americas.
- Before writing any copy, follow the Writing Guide's "Before you write". The Supporter tier names ruling applies: an allowance reads as a thank-you, never as a plan.
- The glossary's Formamorph AI and subject entries lose their monthly wording. It gains **Allowance Ring**.
- No world or save export shape changes.

## Testing Decisions

A good test drives external behavior through a seam and asserts what a player or admin observes. Each guard is proven by reinstating its bug once. No live provider calls run in the gates.

- **Seam 1: the server routes over HTTP**, with the shared test context and the fake upstream, as in the Formamorph AI proxy tests.
  - Budget and hosted-state sums across the Monday 00:00 UTC boundary, including a week spanning two months and a year.
  - A turn admitted before the reset finishes after it.
  - A warning acknowledged last week shows again this week.
  - A known prompt type stored; an absent or unknown one stored as null, with the call admitted.
  - The header never reaching the upstream.
  - Breakdown shares weighted by cost, with cached and output tokens priced differently.
  - No dollar amount in any response outside the admin routes.
  - The admin read listing every type.
- **Seam 2: the Request Transport against a fake proxy**, with the existing SSE fixtures.
  - The prompt type header on every pass of a turn, and on a Formaquestion call.
  - No header on a request to another endpoint.
- **Seam 3: the breakdown rollup module** (new), as a pure function.
  - The threshold's edge, both sides.
  - Nested rows, and no nested row in a one-prompt group.
  - Largest-remainder totals of 100, and an Other row only above zero.
  - An empty breakdown.
  - Every `AIRequestType` has a group.
- **Seam 4: the rendered action box**, through the GamePanels test harness.
  - The ring shows for a narration prompt on Formamorph AI, for one pinned prompt, and not for neither.
  - The figure holds during a turn and moves when it ends, including an aborted turn.
  - The toast at the highest threshold only.
  - The popover's content per state, including paused and locked.
  - Mobile-width expansion on focus and collapse on blur, with Send present throughout.
- Live checks use the dev router with a new fixture per state. Mobile layout gets a static frame at a real mobile width, and color changes get both themes.

## Out of Scope

- A monthly meter or rollover of unused allowance.
- Rolling per-account weeks.
- Dollar or token values shown to a player.
- A breakdown on the site profile, or for past weeks.
- Top-ups or paid extra allowance.
- Breakdown per world.
- The Steam free tier's cap.
- The Send and Stop width change, which already landed.

## Further Notes

- **The user's steps before release:** set each tier's weekly budget in server settings, and write weekly into the Patreon tier descriptions. A server already holding monthly values must have them replaced at the same deploy.
- The budget math stays in the local hosted-tier note. Don't put it in tickets, code comments or commit messages.
- The ring needs the user's design approval, so the ticket that builds it starts with a mock.
- The server work lands first, because the client reads `breakdown` from it. Server tickets carry a `Repo: FormamorphServer` line.
