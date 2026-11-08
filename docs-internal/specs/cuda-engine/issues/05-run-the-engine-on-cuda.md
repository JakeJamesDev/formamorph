# 05: Run The Engine On CUDA

Status: ready-for-agent
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

- [ ] Auto starts on CUDA when it is installed and supported, and `gpuBackend` reads `cuda`. (engine test with the recorded CUDA fixtures)
- [ ] Auto stays on Vulkan when CUDA isn't installed, when the machine is unsupported, or in the mixed-GPU case. Pinning the NVIDIA card in the mixed case starts on CUDA.
- [ ] NVIDIA plus an integrated GPU counts as not mixed, and Auto starts on CUDA.
- [ ] The Backend setting overrides Auto both ways, and changing it reloads a running engine.
- [ ] CUDA is grayed out in the Backend control until installed. (Local Model panel test)
- [ ] The device picker shows the running backend's devices, and a pin by name carries across backends.
- [ ] An install that lands while the engine runs on Vulkan shows "Restart on CUDA", and the engine doesn't reload on its own.
- [ ] The CUDA start sets the JIT cache size, and the spec records the value's source.
- [ ] Frames: `.scratch/frames/backend-control.png` in light and dark, at the panel's realistic width.

For you: start a model on CUDA on the 4090, and compare the feel with Vulkan in a normal play session. Local Model panel, then any world.
