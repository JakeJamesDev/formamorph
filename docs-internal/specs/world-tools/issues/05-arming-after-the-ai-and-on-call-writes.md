# 05: Arming, After The AI And On Call Writes

Status: done
Blocked by: 01, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the core trigger model, with turn-scoped state that must vanish on regenerate and cancel.

## What to build

A World Tool's Script handler gains a timing (On Call, During AI Output, After the AI), a **Reply** field and a **Stack Calls** switch, shown on World Tools only (Q5, Q12). Calling an After the AI Tool arms a trigger: the Tool returns the Reply, or "Done." when empty, and runs no code (R1, Q1). Stack Calls off replaces the armed trigger on a later call; on, every call fires in call order (R4). After triggers run in the After the AI batch, in Tools-tab order, before the world's After Scripts (Q4). An On Call World Tool runs its script at once with the full write surface plus `args`, and returns its value. Triggers last one turn (R6). Regenerate and cancel drop the triggers and every write they made (Q2). Errors follow the Scripts rules (Q3). User Tools keep no timing and no writes (Q12). This ticket arms During AI Output Tools but fires them only in ticket 06.

Spec: R1, R2, R4, R6, Q1–Q4, Q12, Q13; stories 6, 7, 9–16, 36, 37, 41, 43.

## Acceptance criteria

- [ ] Through `runTurn` with a fake stream, an After the AI Tool call returns its Reply to the next round and its script's stat write lands with the turn
- [ ] An empty Reply returns "Done."; an On Call Tool returns its script's value and its writes are visible to later reads in the turn
- [ ] Stack Calls off: two calls fire once with the second call's `args`; on: two calls fire twice in call order
- [ ] An armed trigger runs before a world After Script, and a later write by the Script wins a shared field
- [ ] Regenerate and cancel drop triggers and On Call writes; nothing armed survives into the next turn
- [ ] A user Tool rejects a timing; its script still cannot write
- [ ] Importing a world with a malformed or duplicate-name World Tool drops it and shows a toast with the count and reason (Q34)
- [ ] Changelog fragment written
- [ ] Four gates green

## Blocked by

- 01 World Tools Shape And Tools Tab
- 03 Location, Clock And Discovery Writes
