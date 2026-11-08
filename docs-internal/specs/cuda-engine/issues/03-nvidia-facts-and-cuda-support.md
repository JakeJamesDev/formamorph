# 03: NVIDIA Facts And CUDA Support

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: a pure policy plus one guarded process call, with the floors fully specified.

## What to build

The app learns whether this machine can run the CUDA build. A separate nvidia-smi query, with a timeout, reads each NVIDIA card's driver version and compute capability. The existing VRAM query stays as it is, so a driver that rejects a field can't make the Hardware tab or Auto's device pick read "no GPU". A pure support rule turns those facts into supported, or a reason: card too old, driver too old, support unknown, or no NVIDIA card. Floors: R580 for 8.6, 8.9, 12.0 and 12.1. R615 for every other capability of 7.5 or higher. With several NVIDIA cards, every card must pass.

This ticket owns the support rule. Tickets 04, 05 and 08 use it and never re-derive it. The main process exposes the result to the renderer through the desktop bridge. Ticket 04 adds it to the install status.

No player-visible change on its own, so no changelog fragment.

## Acceptance criteria

- [x] The support rule's tests cover each floor at its edges: 8.6 on R579 and R580, 7.5 on R614 and R615, 9.0 on R580 (fails) and R615, and 6.1 (card too old). (`electron/cudaSupport.test.mjs` "floors"; lowering the PTX floor to 580 turned two tests red.)
- [x] With several NVIDIA cards, one failing card makes the machine unsupported, with that card's reason. ("several cards" test.)
- [x] A rejected field, a missing nvidia-smi, or a timeout gives "support unknown". The VRAM query's result is unchanged in each case. (The query is a separate module; `vramCollect.cjs` is untouched. Test "asks for the facts in a query of its own".)
- [x] The renderer can read the support result through the desktop bridge. (`cudaSupport` in preload, IPC `cuda-support`, `desktopCudaSupport()` in `desktop.ts`; typecheck green. Not run in a live app.)

## Landed

**Not verified**
- The bridge call in a running Electron app, and real nvidia-smi output on the 4090.

**For you**
- Nothing.
