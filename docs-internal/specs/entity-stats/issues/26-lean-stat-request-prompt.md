# 26: Lean Stat Request Prompt

Status: wontfix

Closed as missed: lean failed the Q84 bar on Cydonia, without the What to change rules (Q86) and with them (Q88). A rerun through the app's request layer gave the same result. The 921dcace prompt stays the default.
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a prompt change gated by a strict two-model, two-set probe bar; the app-built prompt has never been probed, so the bar can fail.

Parent: [Entity Stats spec](../spec.md)

## What to build

The default Stat Updates prompt becomes a lean prompt (ruling Q84, which replaces Q78). The model gets less text and must still record the right changes.

- **System:** one role line, then the world description, traits and notes chips. Then each owner's stats under its heading, with groups rendered as the app renders them, then format lines. One format line covers the signed change for every stat (0 for no change), and one covers the `<stat> max` keys.
- **User:** the narration.
- The schema stays as it is, `max` keys included.
- The schema-less text prompt stays unchanged.
- User presets keep their frozen copy. The changelog tells players to reset a preset to get the new default. No migration.

Evidence is in `eec488c6` (probe arms L, LT, LV, LD and LR, and the held-out cases). Lean arm L used plain stat lines, but the app renders stats as `- **Name:** 62/100 — meaning`. The app rendering has not been probed yet.

## Acceptance criteria

- [ ] The probe builds the lean prompt through the app's own builder, not a copy of it.
- [ ] Arms: lean flat, lean grouped, lean with the regard line, and lean without `max` keys (to measure their cost). The in-batch controls are today's S and SG.
- [ ] **Ship bar (Q84):** lean beats S and SG on exact and on invented changes, on the cloud model and Cydonia, on the tuning set and the held-out set. At least 6 runs per case on cloud and 3 on Cydonia.
- [ ] If lean with and without the regard line both pass, lean ships without it.
- [ ] On a miss, the ticket stops and reports every arm's numbers to the user. Nothing ships.
- [ ] `statSchemaCap` fits lean replies. Pretty-printed replies for 4–5 owners hit the cap in 12% of familiar-sheet replies, so the cap is checked and raised if needed.
- [ ] The text-pass swap still triggers on the new default.
- [ ] A changelog line tells players to reset their presets for the new default.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
