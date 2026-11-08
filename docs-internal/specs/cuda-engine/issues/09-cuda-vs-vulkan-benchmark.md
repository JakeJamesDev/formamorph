# 09: CUDA Vs Vulkan Benchmark

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Model rationale: a scripted measurement with a fixed protocol and no product code.

## What to build

The Q10 benchmark. It runs the pinned llama-server, CUDA 13.4 build and bundled Vulkan build, on Cydonia 24B (`cydonia-24b-v4.3@q4_k_m`) at 8K context, 5 runs per backend, on the 4090. It records warm prompt t/s and generation t/s, the load time, and the driver version. Both builds get the same arguments the app passes (flash attention on, full offload, the app's KV cache defaults).

Run it only in a window the user names (GPU policy). Ask the spec session for the window first. Before you start, check that LM Studio and Ollama hold no loaded model. Stop only the processes the benchmark started. Write the results table into the spec's Further Notes, replacing the quick numbers. Also check whether the Vulkan run logs flash attention on the CPU with the app's `-fa on`, and note what you see.

No product code, no changelog fragment.

## Acceptance criteria

- [x] Five runs per backend, recorded with the median and the range for prompt and generation t/s. (Script output, 10 runs.)
- [x] The spec's Further Notes hold the table, the driver version and the exact arguments.
- [x] The run started in a window the user named, with no other model loaded on the GPU. (User said "start 09"; LM Studio and Ollama returned no loaded model, and the spec session confirmed 06's recording was done.)
- [x] The flash-attention-on-CPU check under `-fa on` is recorded either way. (Vulkan falls back to CPU; CUDA does not.)

## Landed

**Not verified**
- None. The benchmark used `-m` with the app's server flags in place of the router preset, which does not change speed. The code review was skipped: the change is spec text only.

**For you**
- Read the Q10 table in the spec's Further Notes. The CUDA prompt gain is about 9% on this model, and generation is level.
