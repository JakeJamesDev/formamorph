# 09: Prompt Runtime

Status: done
Blocked by: 01
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

Fable at high: the async QuickJS engine, a suspended host call, a timeout that pauses, and a cancel path that drops writes.

## What to build

A script that names `player.` runs on the async engine, where `player.confirm`, `player.ask`, `player.askText`, `player.tell` and `player.toast` are host functions that suspend the VM until the host answers (Q8). Every other script keeps the sync engine. The one-second timeout pauses while a prompt is open. The host side is a pending-prompt store the UI answers; this ticket answers it from tests. Escape or a close fails the script as canceled and drops its writes (Q15). `player.*` in During AI Output fails the script (Q14). `ask` takes strings or label-value pairs and `{ multiple: true }` returns an array.

Spec: Q8, Q14, Q15, story 10.

## Acceptance criteria

- [ ] `const pick = player.ask('Door?', ['Left', 'Right'])` suspends, and the script reads the answer the test supplies
- [ ] A prompt held open past one second does not time out; a loop after the answer still does
- [ ] A cancel fails the script with a canceled error and no stat write lands
- [ ] A script without `player.` runs on the sync engine; a test asserts which engine ran
- [ ] The async engine's WASM is excluded from dev pre-bundling like the sync one
- [ ] Four gates green

## Blocked by

- 01
