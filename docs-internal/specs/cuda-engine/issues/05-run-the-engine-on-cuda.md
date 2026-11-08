# 05: Run The Engine On CUDA

Status: ready-for-human
Blocked by: 03, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: crosses main, the engine's utility process and the panel, and needs new recorded fixtures for the fake server.

## What to build

With CUDA installed, the built-in engine runs on CUDA. A Backend setting (Auto / Vulkan / CUDA, default Auto) sits beside the device picker, and CUDA is grayed out until installed (Q11). Auto picks CUDA when ticket 03 says the machine is supported. In the mixed-GPU case (an NVIDIA card plus a non-NVIDIA card that isn't integrated), Auto stays on Vulkan unless the device setting pins the NVIDIA card (Q14). NVIDIA plus an integrated GPU is not mixed. The device policy's integrated-name test is shared for this. The device picker lists the devices of the backend that will run, and the pin stays a device name.

Main resolves the CUDA folder and passes the server binary to the engine in the start options, since the engine's utility process can't see user data. The Backend setting joins the options whose change reloads a running engine. When an install lands while the engine runs on Vulkan, the engine stays on Vulkan until its next start, and the panel offers "Restart on CUDA" (Q17). The status line already labels the backend that ran. The engine spawns llama-server with a larger CUDA JIT cache; take the value from NVIDIA's documented range and record the source in the spec.

This ticket owns the backend choice; ticket 06 adds the CUDA failure path to it. In a CUDA start where the CUDA build lists no devices, the start goes to the Vulkan path as today.

Fixtures: the fake server replays recorded runs only, and it must answer by binary so one start can see CUDA and then Vulkan. Record a CUDA listing and a CUDA load with the fixture recorder. That needs a GPU window from the user (GPU policy), so ask the spec session before recording.

The Backend setting is device-local and never goes in backups, worlds or saves; no export shape changes. Changelog fragment under 👤 Added, or folded into ticket 04's entry when that is still unreleased.

## Acceptance criteria

- [x] Auto starts on CUDA when it is installed and supported, and `gpuBackend` reads `cuda`. (engine test with the recorded CUDA fixtures) — `CUDA backend › Auto starts on CUDA…`, over `b12078-cuda.json` recorded on the 4090.
- [x] Auto stays on Vulkan when CUDA isn't installed, when the machine is unsupported, or in the mixed-GPU case. Pinning the NVIDIA card in the mixed case starts on CUDA. — engine tests `…not installed`, `…unsupported machine`, `…beside another discrete GPU, and pinning…`.
- [x] NVIDIA plus an integrated GPU counts as not mixed, and Auto starts on CUDA. — engine test `counts an integrated GPU…`.
- [x] The Backend setting overrides Auto both ways, and changing it reloads a running engine. — engine test `the Backend setting overrides Auto both ways`; panel test `arms Save & Reload on a change and sends the setting`. Main's reload compare (`llm-set-options`) is checked by reading; no test drives main.cjs.
- [x] CUDA is grayed out in the Backend control until installed. (Local Model panel test) — `grays CUDA out until it is installed`, `keeps a stored CUDA choice selected but grayed…`.
- [x] The device picker shows the running backend's devices, and a pin by name carries across backends. — panel test `lists the devices of the backend the settings would run…` (next start's backend, per spec-session ruling 4); engine test `a device pin by name carries across backends`.
- [x] An install that lands while the engine runs on Vulkan shows "Restart on CUDA", and the engine doesn't reload on its own. — panel test `offers Restart on CUDA when CUDA lands under a Vulkan run…`.
- [x] The CUDA start sets the JIT cache size, and the spec records the value's source. — engine test `sets the CUDA JIT cache to its 4 GiB maximum on a CUDA start only`; spec "Backend choice at engine start".
- [x] Frames: `.scratch/frames/backend-control.png` in light and dark, at the panel's realistic width. — 1280×900 headless Chrome with a desktop shim; `-dark` and `-open` twins.

For you: start a model on CUDA on the 4090, and compare the feel with Vulkan in a normal play session. Local Model panel, then any world.

## Landed

**Not verified**
- A real CUDA start inside the packaged app. The engine tests replay the recorded CUDA run; main's wiring (`backendChoice`, `llm-restart`, `llm-list-devices`) has no test harness.
- That the 4 GiB JIT cache keeps compiled kernels across starts on an RTX 20 or GTX 16 card. No such card here.

**For you**
- Start a model on CUDA on the 4090, and compare the feel with Vulkan in a normal play session. Local Model panel, then any world.
- Look at the Backend row: `.scratch/cuda-engine-05/frames/backend-control.png`, `.scratch/cuda-engine-05/frames/backend-control-dark.png`, and the open lists `backend-control-open.png` / `backend-control-dark-open.png`.

**For ticket 06**
- A CUDA load that fails today takes the CPU retry on the CUDA binary, with the JIT cache variable set. Ticket 06 puts the Vulkan attempt before it.
