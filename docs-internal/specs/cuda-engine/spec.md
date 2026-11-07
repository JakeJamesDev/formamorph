# Spec: CUDA Engine

Status: ready-for-agent

Windows desktop only. An optional download that lets the built-in engine run llama-server's CUDA build on NVIDIA cards.

## Problem Statement

The built-in engine ships one Windows build of llama-server: Vulkan. Players with NVIDIA cards ask for CUDA, and some report a large speed gap on their machines. Today they must leave the built-in engine for LM Studio or another server to get it.

## Solution

Players with a supported NVIDIA card can download the CUDA build of the same pinned llama-server from the engine area of the Local Model panel, or from a one-time prompt on their first engine start. Once it is installed, Auto runs the engine on CUDA. A Backend setting (Auto / Vulkan / CUDA) overrides that. If CUDA fails, the start falls back to Vulkan and says so. Updates that move the llama.cpp pin replace the CUDA build in the background, and the engine uses Vulkan until the new one lands.

## Rulings

- **Q1** Build it whatever the benchmark shows. The benchmark records numbers only.
- **Q2** Windows only. Linux NVIDIA players keep Vulkan.
- **Q3** CUDA 13.4 only. Floors: driver R580 for RTX 30/40/50 (precompiled code), R615 for RTX 20 and GTX 16 (code compiled on first start). Pascal and older cards, and drivers under the floor, stay on Vulkan. The row tells an under-floor player to update the driver.
- **Q4** The files come from the pinned tag's assets on the ggml-org/llama.cpp GitHub release. No mirror.
- **Q5** The download row lives in the Local Model panel's engine area and shows only when nvidia-smi finds an NVIDIA card. A one-time prompt offers it too.
- **Q6** After the download, Auto uses CUDA. The Backend setting is the override.
- **Q7** A pin bump downloads the new CUDA build in the background without asking. The engine uses Vulkan until it lands. The old tag's folder is then deleted.
- **Q8** Steam uses the same runtime download. No depot, no DLC.
- **Q9** The prompt shows once, on the first engine start on a machine with a supported card. Dismissing it leaves the row in the engine area.
- **Q10** Benchmark: Cydonia 24B, 8K context, 5 runs per backend, CUDA vs Vulkan, in a window the user names. Results go in this spec.
- **Q11** The Backend setting sits beside the device picker. CUDA is grayed out until the download is installed.
- **Q12** A CUDA start or load failure falls back to Vulkan for that start, with a one-line notice and Error Details.
- **Q13** The download row states that the files are NVIDIA's CUDA libraries under NVIDIA's license, with a link to the CUDA EULA. Credits lists cuBLAS and the CUDA runtime.
- **Q14** On a machine with an NVIDIA card and another discrete GPU, Auto stays on Vulkan unless the device picker pins the NVIDIA card.
- **Q15** Every Windows channel gets it in this effort: GitHub, itch, Steam.

## User Stories

1. As a player with an RTX card, I want to download CUDA support from inside the app, so that I don't have to install a separate server.
2. As a player with an RTX card, I want the app to offer CUDA the first time I start the built-in engine, so that I learn the option exists.
3. As a player who dismissed the prompt, I want the download row to stay in the engine area, so that I can get CUDA later.
4. As a player without an NVIDIA card, I want to never see the CUDA row or prompt, so that the panel stays relevant to my machine.
5. As a player, I want to see the download size before I start, so that I can decide on a metered or slow connection.
6. As a player, I want download progress and a Cancel, so that I know how long it takes and can stop it.
7. As a player whose download was interrupted, I want it to resume, so that I don't download 600 MB again.
8. As a player, I want the engine to use CUDA automatically once the download finishes, so that I don't have to find another setting.
9. As a player, I want a Backend setting (Auto / Vulkan / CUDA) beside the device picker, so that I can choose the backend myself.
10. As a player who has not downloaded CUDA, I want the CUDA choice grayed out, so that I understand it needs the download first.
11. As a player, I want the engine status to show which backend is running, so that I can confirm CUDA is in use.
12. As a player whose driver is too old, I want the row to tell me to update my NVIDIA driver, so that I know how to unlock CUDA.
13. As a player with a GTX 10-series or older card, I want the app to keep me on Vulkan, so that I don't download files that can't run.
14. As a player with an RTX 20 or GTX 16 card, I want CUDA to work on a current driver, even if the first load is slower, so that I get the faster engine.
15. As a player, I want a failed CUDA start to fall back to Vulkan and tell me, so that I still get my model and know something went wrong.
16. As a player who hit a CUDA failure, I want Error Details, so that I can report the problem.
17. As a player with an NVIDIA card and an AMD card, I want Auto to keep using both through Vulkan, so that I don't silently lose VRAM.
18. As a player with an NVIDIA card and an AMD card, I want to pin the NVIDIA card and get CUDA, so that I can choose speed on one card.
19. As a player, I want an app update to refresh CUDA in the background, so that I don't lose CUDA after updating.
20. As a player during that refresh, I want the engine to keep working on Vulkan, so that I can still play.
21. As a player, I want old CUDA files removed after an update, so that they don't take disk space.
22. As a player, I want a Remove button, so that I can free the disk space.
23. As a player, I want to see that the files are NVIDIA's libraries under NVIDIA's license, so that I know what I install.
24. As a player who keeps data beside the app, I want the CUDA files to survive app updates, so that an update doesn't remove them.
25. As a Steam player, I want the same CUDA option, so that my channel isn't missing a feature.
26. As a player, I want a corrupt or tampered download refused, so that the engine never runs bad files.
27. As a developer, I want the CUDA build pinned to the same llama.cpp tag as the bundled build, so that the proxy and log parsers always match the binary.
28. As a developer, I want a pin bump to fail loudly when the release lacks the CUDA assets, so that a release never ships a broken CUDA path.
29. As the maintainer, I want benchmark numbers in this spec, so that we can answer players who ask what CUDA gains.

## Implementation Decisions

**The CUDA build.**
- Two assets from the pinned tag: `llama-<tag>-bin-win-cuda-13.4-x64.zip` (about 169 MB) and `cudart-llama-bin-win-cuda-13.4-x64.zip` (about 424 MB). Both unpack into one folder.
- The release uses loadable backends. The CUDA zip has the same `llama-server.exe` and CPU backends as the Vulkan zip, plus `ggml-cuda.dll`. The cudart zip adds cuBLAS, cuBLASLt and the CUDA runtime.
- The CUDA folder stays separate from the bundled Vulkan folder. If both `ggml-cuda.dll` and `ggml-vulkan.dll` load, the engine sees each NVIDIA card twice, which is the memory-budget problem the device policy fixes.

**Where it lives.**
- One folder per tag in the app's data folder beside the root, such as `engines/<tag>/win-x64-cuda-13.4/`. On Windows the launcher swaps `<root>/app` on every update, so the folder must not live under `app/`.
- The portable profile and the profile-merge code must treat the folder as engine data, never as a player's model.

**The pin.**
- The pin file gains the SHA-256 digest of each CUDA asset. The GitHub release API publishes a `digest` per asset. The fetch script records the digests when the pin moves and fails if the CUDA assets are missing.
- The CUDA folder is valid only when its marker names the current tag and both digests matched.

**The CUDA install module (main process).**
- Downloads both assets with the existing resumable downloader and its partial-file handling. The allow-list holds only the GitHub release hosts.
- Checks each digest, unpacks with Windows' own `tar.exe`, writes the marker, then swaps the folder in place.
- Reports progress to the renderer with the same event shape as the model download.
- On a pin bump with CUDA installed, it starts the new tag's download in the background on the first app start. After the new folder lands, it deletes every other tag's folder.
- Remove deletes the folder. Cancel keeps the partial files so the download can resume.
- Interface: `status()` → not-installed / downloading (bytes, total) / installed (tag) / stale (old tag) / unsupported (reason). Also `install()`, `cancel()` and `remove()`.

**Eligibility (pure policy beside the device policy).**
- Inputs: nvidia-smi rows (name, `driver_version`, `compute_cap`), the Vulkan device names, the Backend setting, the device setting, and the install status.
- Supported: compute capability 7.5 or higher. Floor: R580 for 8.6 and up, R615 for 7.5 to 8.5.
- Output: the backend for this start, and a reason when CUDA is not used: not installed, driver too old, card too old, mixed GPUs, or setting.
- The main process's nvidia-smi query gains `driver_version` and `compute_cap`.

**Backend choice at engine start.**
- The engine's binary lookup takes a backend and resolves the CUDA folder for `cuda`.
- Auto runs CUDA when eligibility says yes. In a mixed-GPU case (Q14), Auto stays on Vulkan unless the device setting names the NVIDIA card.
- A CUDA build that lists no devices, or fails the load, is followed by one Vulkan attempt. The existing CPU fallback still follows a failed Vulkan load.
- The engine state carries the backend that ran, plus a fallback flag and error text. The panel shows the notice and the Error Details from these.
- The device setting is stored by device name, but CUDA (`CUDA0`) and Vulkan (`Vulkan0`) can name the same card differently. The pin must resolve across backends, or fall back to Auto for that start.
- The engine spawns llama-server with a larger CUDA JIT cache (`CUDA_CACHE_MAXSIZE`), so RTX 20 and GTX 16 cards compile the kernels once.

**Settings.**
- A new device-local Backend setting, `auto | vulkan | cuda`, default `auto`, in the settings defaults. It is never exported in worlds or saves. A device-local setting changes no export shape. Check the settings-backup path before you decide whether it carries the setting.
- A device-local "CUDA prompt seen" flag.

**UI (Local Model panel, engine area).**
- On NVIDIA machines only:
  - A row with the download size, Download, progress, Cancel, Remove, the NVIDIA license line with the EULA link, and the reason text (driver too old, card too old).
  - The Backend control beside the device picker.
  - The one-time prompt on the first engine start.
- A new pattern, such as the prompt's form, needs the user's approval before adoption (Design System rule).
- Final copy comes from the Writing Guide. The strings in this spec are working text.

**Credits.**
- An entry for cuBLAS, cuBLASLt and the CUDA runtime under the NVIDIA CUDA EULA, through `gen-notices` and its drift guard. The notice applies when the files are installed.

## Testing Decisions

A good test drives a seam from outside and asserts what a player or the engine state would see. Tests never assert internals, and never shape a scenario so that a fallback can't fire. A test for a guard (digest, eligibility, fallback) must fail when its bug comes back.

1. **Engine start** through the engine factory and the fake llama-server:
   - Auto picks CUDA when it is installed and eligible.
   - Auto stays on Vulkan for mixed GPUs, an old driver, an old card, or no install.
   - The setting overrides Auto.
   - A CUDA failure falls back to Vulkan and the state shows the notice. A Vulkan failure still reaches the CPU fallback.
   - A device pin resolves across backends.
   - Prior art: the "CPU fallback and load errors" and "device listing" suites in the engine tests. The fake server needs a CUDA device listing.
2. **CUDA install module**, with an injected fetch and a temp data folder:
   - Download, resume, and Cancel.
   - A digest mismatch is refused and nothing is installed.
   - Unpack, marker, and status.
   - A pin bump runs the background replace while status reads stale, then deletes the old tag.
   - Remove.
   - Prior art: the model download and stream download tests.
3. **Local Model panel**:
   - The row shows on NVIDIA only and hides elsewhere.
   - The prompt shows once on the first engine start.
   - CUDA is grayed out until installed.
   - The reason text appears for driver and card limits.
   - The fallback notice and the Error Details show.
   - Prior art: the Local Model panel tests (KV cache rows, Unified KV Cache row).
4. **Eligibility policy**:
   - Covered through seam 1. Table cases go there unless a pure-function test is clearly cheaper, as the device policy's tests are.
5. **Fetch script**:
   - Records digests and fails when CUDA assets are missing.
   - Prior art: the fetch script's existing test.
6. **Manual checks for the user**:
   - A real download on the 4090.
   - The Q10 benchmark.

## Out of Scope

- Linux and macOS CUDA, a CUDA 12.4 build, and support for Pascal and older cards.
- Hosting the files ourselves, and a Steam depot or DLC.
- CUDA for image generation or any engine other than llama-server.
- ROCm, SYCL and OpenVINO builds.
- Runtime version picking beyond the pin, which LM Studio offers.

## Further Notes

**Verified on 2026-11-07** (RTX 4090, driver 616.92):
- The b12078 CUDA 13.4 `ggml-cuda.dll` holds precompiled code for 8.6, 8.9, 12.0 and 12.1, and PTX ISA 9.4 for 7.5, 8.0 and 9.0. It was built by nvcc 13.4.
- A forced-JIT run (`CUDA_FORCE_PTX_JIT=1`, the RTX 20 path) loaded and ran.
  - Load took 21.6 s against 7.1 s for the precompiled path.
  - The first prompt ran at 34 t/s. After that, speed matched the precompiled path.

**Driver floors.**
- NVIDIA's CUDA 13 minor-version compatibility floor is R580.
- Code compiled on first start needs a driver that knows the PTX ISA. For ISA 9.4 that is the R615 branch (13.4). This floor is inferred from NVIDIA's PTX rule; drivers older than R615 were not tested.

**Quick numbers** (one 4B Q4_K_M model, 2 runs, not the Q10 benchmark):

| Backend | Prompt t/s (warm) | Gen t/s |
|---|---|---|
| CUDA | about 9,750–10,100 | about 212 |
| Vulkan | about 6,380 | about 198 |

**Licensing.**
- The CUDA EULA (updated January 26, 2026) lists `cublas` and `cublasLt` as redistributable for Windows, including versioned names.
- It has no explicit notice clause for binaries.
- Whether the app becomes the distributor when the files come from ggml-org's release is not settled. NVIDIA's contact for that question is nvidia-compute-license-questions@nvidia.com.

**Steam.** The public Steamworks pages have no rule on runtime downloads from third-party hosts. The Steam Distribution Agreement itself was not checked.

**Seen in passing, not part of this effort.** A Vulkan run printed "Flash Attention over K/V rows is assigned to device CPU". Whether the app's own `-fa on` start hits the same fallback is not checked.
