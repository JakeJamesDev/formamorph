# 04: Entity Location Request and Followers

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The core play change: a new turn pass, a new prompt, and the commit join. Speed is the top priority.

## What to build

A Can Follow entity in the scene gets one small AI request per turn, run in parallel with the player's location request and in the same stage. When it answers "come along" and the player moves, it joins the followers and travels with the player on every later move, including Map travel and code moves, until it answers "stay here". Stays Put entities never get a request. A new **Entity Movement** setting turns the requests off without undoing the author's rules.

## Acceptance criteria

- [ ] A new turn pass fans out one request per tracked scene entity with Can Follow, and per follower. It runs in the player request's stage (before narration in auto mode, after it in suggest mode) and shares its due rules plus the setting.
- [ ] Its own editable prompt in the Prompts list, with sampler pins and reasoning mode matching the player's location request. It shows in Request Anatomy.
- [ ] Replies come from a closed list (stay / come along; keep following / stay here), matched by the player request's matcher, with a token cap of the longest candidate plus slack.
- [ ] The commit joins in the spec's order. Followers move with every player move and ignore Connections. "Come along" applies only when the player moves.
- [ ] Suggest mode: only "come along" waits; Go applies it, Dismiss drops it. "Stay here" applies at once.
- [ ] Map travel moves followers without a turn or a request.
- [ ] The save gains the follower set.
- [ ] **Entity Movement** setting, on by default. Off stops only these requests. If it gets a `DEFAULT_*` with a `VITE_DEFAULT_*` twin, remind the user about `.env.local`.
- [ ] Turn-commit tests cover join order, sticky following, come-along-only-on-move and suggest Go/Dismiss. Turn-pass tests cover due rules, fan-out and candidates. The parity suite stays byte-equal for a world with no tracked entities.
- [ ] Probe numbers on the cloud default with the player's location pass as the in-batch control, on the Emberwatch cast. A local run measures fan-out queuing on the local engine's single slot, in an agreed window.
- [ ] Save-shape reminder in the landing reply.
