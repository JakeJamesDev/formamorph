# Engine Device Pinning — Spec

Status: ready-for-agent

## Problem Statement

On desktop machines with more than one Vulkan-visible GPU (typically a discrete card plus an integrated GPU), the bundled engine's memory accounting aggregates every adapter into one budget. A field machine with an RTX 4080 (16 GB, ~14.7 GB free) plus an Intel UHD 770 reported a fictional 47.8 GB total with **0 GB free** before any load. The engine sizes model loads against that free value, so every model at every setting fails with "not enough VRAM" — or silently offloads zero layers and runs on CPU — while the app's own GPU-memory readout shows a nearly idle discrete card. The failure appears "randomly" to players because a driver update that installs or activates the iGPU's Vulkan driver is enough to flip a working machine into this state, and reinstalling the app fixes nothing.

## Solution

The engine pins its Vulkan backend to one GPU. By default (Auto) the app picks the discrete card by matching enumerated Vulkan device names against the GPUs nvidia-smi reports, falling back to excluding known integrated-GPU name patterns; with one device pinned there is no multi-adapter aggregate, so the engine's free-memory figure is the real device's own and loads size correctly. A device picker in the Local Model options makes the choice inspectable and overridable — a player can see which GPU the engine will use and force a different one without any developer involvement. The Engine Device readout (already shipped) continues to show what was actually selected, so a wrong pick is visible in one screenshot.

Mechanism (verified live): llama.cpp's Vulkan backend honors a `GGML_VK_VISIBLE_DEVICES` environment variable at initialization, restricting device creation to the listed indices; the variable passes through node-llama-cpp's in-process backend, and the order of `getGpuDeviceNames()` is the index order. Because the engine already runs in its own child process, the variable can be set in that process's environment before the native backend initializes — no global environment change, and a later device change is just an engine restart, which the proxy already performs.

## User Stories

1. As a desktop player with a discrete GPU and an iGPU, I want the engine to load models onto my discrete card automatically, so that models load instead of failing with "not enough VRAM".
2. As a desktop player whose machine broke after a driver update, I want the app to stop counting my iGPU's shared memory in its VRAM budget, so that a working setup stays working across driver updates.
3. As a desktop player, I want to see which GPU the engine selected in the Local Model window, so that I can tell at a glance whether it picked the right card.
4. As a desktop player, I want a device picker listing every GPU the engine can see, so that I can override a wrong automatic choice myself.
5. As a desktop player, I want the picker to default to Auto, so that I never have to touch it when the automatic choice is right.
6. As a desktop player who changes the device, I want the engine to restart onto the new device and reload my model, so that the change takes effect without restarting the app.
7. As a desktop player on a single-GPU machine, I want Auto to behave exactly as today, so that pinning never regresses the common case.
8. As a desktop player on a CPU-only machine, I want the picker to say no GPU is available rather than offer an empty list, so that the state is legible.
9. As a desktop player with an AMD or Intel discrete card (no nvidia-smi), I want Auto to still avoid pinning to an integrated GPU, so that the fix is not NVIDIA-only.
10. As a desktop player whose devices cannot be told apart by name, I want Auto to leave the engine's default behavior untouched rather than guess, so that a wrong pin never makes things worse than today.
11. As a desktop player, I want my device choice remembered across launches, so that I set it once.
12. As a desktop player whose chosen device disappears (eGPU unplugged, driver removed), I want the engine to fall back to Auto and say so, so that the app still loads models rather than failing on a stale pin.
13. As a player reporting a bug, I want the Engine Device line to reflect the pinned device and the pick's origin (Auto or manual), so that support screenshots carry the whole story.
14. As a developer triaging VRAM reports, I want the enumerated device list and the applied pin in the engine state, so that the wrong-device class of bug is diagnosable without reproduction.
15. As a developer, I want the selection policy to be a pure function, so that every branch of the pick is unit-testable without spawning processes.
16. As a web (non-desktop) player, I want none of this to affect the browser app, so that the change is desktop-only surface.

## Implementation Decisions

- **Selection policy is one pure function** taking the enumerated Vulkan device names, the nvidia-smi GPU list, and the user's setting (`auto` or a device identity), returning the device index to pin or null for "leave unfiltered". All heuristics live here; nothing else decides.
- **Auto policy, in order**: a device whose name matches an nvidia-smi GPU name wins (lowest index on ties); otherwise exclude devices matching known integrated-GPU name patterns (Intel UHD/Iris/Arc integrated, AMD "Radeon(TM) Graphics") and pin the sole survivor; if zero or several survive, return null — llama.cpp's own default stands. Single-device machines short-circuit to null (no filter, today's behavior).
- **The pin is applied inside the engine child process**: the start request carries the resolved device index, and the host sets `GGML_VK_VISIBLE_DEVICES` in its own process environment before the native backend initializes. Changing the device tears the engine process down and starts a fresh one, reusing the proxy's existing restart path; the same applies when clearing a pin, since an initialized backend cannot re-enumerate.
- **Enumeration source**: the engine process reports its visible device names in state (already shipped). When a pin is active, the full unfiltered list for the picker comes from the last unpinned enumeration, cached main-process-side; a pinned-from-boot session refreshes the cache with a short-lived enumeration-only request before offering choices.
- **The manual setting stores a device identity (name), not a raw index**, resolved to an index at start time against the current enumeration; an identity that no longer resolves falls back to Auto and the state says so. This survives index reordering across driver changes.
- **New setting** follows the existing local-engine settings pattern with default `auto`; it is desktop-only surface like the rest of the Local Model options. No `VITE_DEFAULT_*` twin exists for engine settings, so no env reminder applies.
- **Engine state grows**: the applied filter (index or none) and the origin of the pick (auto / manual / fallback-to-auto). The Engine Device line renders these; the readout's device names now reflect the *filtered* view when pinned, which is the truthful answer to "what is the engine using".
- **Export shape is untouched**: this is settings + engine state, not world or save data.

## Testing Decisions

- Good tests here assert **external behavior at the seams**: what the policy function returns, what the engine state reports, what the picker renders — never how the environment variable is spelled into process internals.
- **Selection policy**: exhaustive unit tests over the branch space — nvidia-smi match, iGPU-pattern fallback, ambiguous multi-device null, single-device null, manual identity hit, manual identity miss (fallback origin), CPU-only empty list.
- **Engine host/proxy contract**: extend the existing engine and proxy contract tests — the start request's device field is echoed in state as the applied filter and origin; the stopped shape gains the new fields as nulls (the field-list tests already guard shape drift).
- **Renderer**: extend the existing Local Model component tests — picker lists devices, defaults to Auto, shows the no-GPU state, and the Engine Device line renders origin; settings default rides the settings-defaults pattern.
- Prior art: the engine state field-list tests and the Engine Device line component tests added with the readout are the direct templates.
- No test spawns a real Vulkan process; the env mechanism itself was verified live on hardware (both filter directions plus index/name-order correspondence) and its application is covered by the state-echo contract.

## Out of Scope

- Filing the upstream node-llama-cpp issue for the multi-device `getVramState().free = 0` aggregation (worth doing separately; this fix is correct for us regardless of the upstream outcome).
- Per-device memory readouts in the picker (the API reports only aggregate memory; names are sufficient to choose).
- Multi-GPU model splitting policy (deliberately pinning to several devices) — llama.cpp default behavior remains for anyone who clears the pin.
- CUDA backend work of any kind; the shipped desktop app is Vulkan-only by design.
- Any change to web builds, world/save export shapes, or the existing GPU-layers / context-size settings.

## Further Notes

- The field evidence: a player's RTX 4080 + UHD 770 machine reported `total 47.8 GB, free 0.0 GB` at load start while nvidia-smi showed 14.7 GB free; a single-device control machine reported sane numbers on the same engine version. The free=0 aggregation is inferred from that pair, not reproduced locally — the upstream report should carry the player's numbers.
- "Worked, then randomly stopped" is explained by driver updates activating the iGPU's Vulkan driver; expect this class of report to recur until pinned.
- The enumeration-order-equals-index-order fact was verified against the live backend and is what the identity→index resolution relies on; if node-llama-cpp ever exposes structured device info, the resolution should move to it.
