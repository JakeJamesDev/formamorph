# 02: Schema Clock Request

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Where the endpoint takes a response schema, the clock pass asks for the three-field reply from the spec (schema v2: `lasts_until`, `unit`, `count`, in that order), so the cloud model can no longer answer with a bare unit, "Few minutes" or leaked thinking. The reply parses into ticket 01's reading and resolves through its anchor math.

- The request carries the schema, a schema reply-format block, and ticket 01's text request as the fallback, like the Inventory pass.
- A clock text-pass setting sends the text request alone when the endpoint's reasoning setting rules the schema out, wired like the inventory and entity-location text passes.
- The clock pass's token cap fits the JSON reply; the temperature 0 pin stays.

## Acceptance criteria

- [ ] The clock request carries the schema and a text fallback; with the text pass on it carries the text format alone.
- [ ] The schema reply-format block is its own run in the request anatomy.
- [ ] A schema reply resolves to the same hours as the matching text reply (an anchor, a day carry, a count with `none`, the guard).
- [ ] An endpoint that refuses the schema gets the text request, and the turn's clock still moves by the text answer.
- [ ] The probe sends the app's real schema request, with the shipped request as the in-batch control, on both case files. Numbers in the Landed section meet the spec's bar: cloud main set at least 87%, dialogue at least 65%; MeroMero 100% on both. A MeroMero run needs the user's go-ahead first.
- [ ] Changelog fragment written.

For you: with native reasoning on for the clock pass, play a turn that runs until nightfall and check the clock still lands at nightfall.
