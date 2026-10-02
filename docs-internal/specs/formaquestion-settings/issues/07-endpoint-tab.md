# 07: Endpoint tab

Status: ready-for-agent
Blocked by: 01, 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A player sends help questions to a different endpoint than the game uses (Q3, Q26, Q27, Q32).

**The tab.**

- **Answer Endpoint:** Follow Active (the default) or one of the text-endpoint presets, with the reachability badge.
- **Pick Endpoint:** Same as Answer (the default), Follow Active, or a preset, with its own badge.
- **The text-endpoint editor** from ticket 01, on the same presets as the regular Settings. An edit here shows there, and the reverse.
- Reset follows the regular Settings: the editor's own reset of a preset. There is no reset of the whole tab (Q24).

**The help session.**

- The answer request and the pick request each resolve their endpoint from the help settings, through the resolver that per-prompt routing uses. A stored id of a deleted preset reads as the default.
- Every branch that depends on the endpoint reads the resolved one: the capability check for functions, the image attachments check, the bundled engine.
- The "no AI" state of the Ask tab follows the answer endpoint. The default cloud endpoint still counts as connected.
- A pick request that fails leaves the question to the other sources, as today.
- The two ids are device settings. They are in no preset and no export.

The Endpoint docs section is written here.

Recommended model rationale: two routed requests, a reachability state that must follow the route, and the engine preset trap from per-prompt routing.

## Acceptance criteria

- [ ] With an answer endpoint set, the answer request goes to it and the pick request follows it.
- [ ] With a pick endpoint set, the two requests go to two endpoints.
- [ ] A deleted preset id falls back to the default with no error.
- [ ] The Ask tab's "no AI" state is true for the answer endpoint, not the active one.
- [ ] A help answer routed to the bundled engine starts the engine, as a routed game prompt does.
- [ ] An edit to a preset in this tab shows in Settings → AI Endpoints.
- [ ] With the defaults, the request bodies and targets equal those of ticket 05.
- [ ] A changelog line is in In Progress.
- [ ] The four gates are green.
