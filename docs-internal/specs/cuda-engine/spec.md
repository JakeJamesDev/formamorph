# Spec: CUDA Engine

Status: ready-for-agent
Spec session: cuda-engine — spec

Windows desktop only. An optional download that lets the built-in engine run llama-server's CUDA build on NVIDIA cards.

## Problem Statement

The built-in engine ships one Windows build of llama-server: Vulkan. Players with NVIDIA cards ask for CUDA, and some report a large speed gap on their machines. Today they must leave the built-in engine for LM Studio or another server to get it.

## Solution

Players with a supported NVIDIA card can download the CUDA build of the same pinned llama-server from the engine area of the Local Model panel, or from a one-time main-menu notice on their first engine start. Once it is installed, Auto runs the engine on CUDA from the next start. A Backend setting (Auto / Vulkan / CUDA) overrides that. If CUDA fails, the start falls back to Vulkan, says so, and Auto keeps to Vulkan until the driver or the build changes. Updates that move the llama.cpp pin replace the CUDA build in the background, and the engine uses Vulkan until the new one lands.

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

Rulings from the spec review (2026-11-07):

- **Q16** Remove stops the engine first, after a confirm. Deleting an old tag's folder waits until the engine next stops or the app next starts, and happens silently.
- **Q17** When an install or a background replace lands while the engine runs on Vulkan, the engine stays on Vulkan until its next start. The panel offers a "Restart on CUDA" button. The engine never reloads mid-play on its own.
- **Q18** The one-time prompt (Q9) is a notice in the main menu, since the first engine start usually happens at boot with the panel closed. It offers Download and Not now. This is a new pattern and needs the user's design approval at build time.
- **Q19** After a CUDA failure, Auto skips CUDA until the tag or the driver version changes. The row says CUDA failed last time and offers Retry. This narrows Q12: the fallback happens once, not on every start.
- **Q20** Before any CUDA download, the background replace included, the app checks free space for the zips plus the unpacked folder. If space is short, it refuses, and the row says how much is needed. A replace that can't fit leaves the engine on Vulkan.
- **Q21** The background replace stays automatic, with no metered-connection check. Cancel in the row is the way out.
- **Q22** The app keeps the folders for the current tag and the newest older tag, so a launcher rollback finds its folder. Older ones are deleted (per Q16).
- **Q23** The NVIDIA distributor question and the Steam Distribution Agreement are an item on the Steam release checklist. They don't block tickets.

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
- One folder per tag under the app's user data folder, in an engines subfolder. Launcher builds keep user data beside the root, so the folder survives the launcher's app swap, the itch app's patching, and a direct start that uses AppData. The Steam layout is not defined in code yet; it follows user data too.
- Portable migration and profile merge copy only browser stores and models, so they never touch the engines folder. No change is needed there.

**The pin.**
- A pin-bump command (new) writes the tag plus the name and SHA-256 digest of each CUDA asset, read from the release API's `digest` field. People run it by hand; the build never writes the pin.
- The build gate checks that the pinned release has both CUDA assets and that their digests match the pin.
- The tag and the digests ship inside the packaged app, because the pin file is not packaged today. The app never calls the GitHub API at runtime: it downloads from the plain release-download URL of each asset (the API allows 60 unauthenticated requests per hour).
- The CUDA folder is valid only when its marker names the current tag and both digests matched.
- Ticket 02 rulings:
  - The digest check runs in the llama-server fetch step and fails the desktop build. It runs even when the bundled builds are already current. It can also run alone through a check flag.
  - The ticket gates and the web build make no network calls.
  - The pin names only the two win-x64 CUDA 13.4 assets.
  - The packaged app reads a copy of the pin from its resources. A dev run reads the source pin.
- Ticket 04 rulings:
  - The pin also records each asset's `size` and `unpackedSize`, and the build gate checks them. The free-space need is both zips plus the unpacked size.
  - Until ticket 07, a stale install reads as not-installed, and Download installs the current tag.
  - The row sits in the Engine section under the device picker, in Simple and Advanced.
  - The driver hint names the card's floor and links NVIDIA's driver download page.
  - The row shows whenever the VRAM query lists an NVIDIA card. When the facts query fails, it shows "support unknown" with no Download. It hides only when no NVIDIA card is listed.
- Ticket 08 rulings:
  - The notice appears the first time the engine reaches loading while the flag is unset, on a supported NVIDIA machine with CUDA not installed. A stale install never shows it.
  - It waits until the intro, the AI setup, the first-run step and any open dialog close.
  - Download closes the notice and starts the install. Progress and errors show only in the engine row.
  - The flag is a device-local key, never in backups, worlds or saves. It is set only by Download or Not now.
  - The user approved the form on 2026-11-07: a non-modal card at the bottom right of the main menu, over the footer icons while shown. The draft copy stands, subject to the Writing Guide pass.
- Ticket 05 rulings:
  - An explicit CUDA setting runs whenever CUDA is installed, whatever the support verdict. The verdict and the mixed-GPU case steer only Auto.
  - When CUDA is set but not installed or updating, the start runs on Vulkan with that reason, and the control shows CUDA selected and grayed.
  - Restart on CUDA shows when the engine is ready on Vulkan and the next start's backend choice is CUDA.
  - The device picker lists the devices of the next start's backend. The status line names the backend that ran.
  - The Backend control shows only on NVIDIA machines, in Simple and Advanced. Auto reads Auto (CUDA) or Auto (Vulkan).
  - CUDA starts set the JIT cache to NVIDIA's documented maximum.
- Ticket 07 rulings:
  - Retention (Q22) keeps the current tag plus the newest other valid folder, older or newer, so a rollback and a roll-forward both find their folder. Everything else is deleted, staging partials included, only while the engine is stopped or at app start.
  - Cancel of the background replace sticks for that target tag until the player clicks Download or Resume. A newer pin tag clears it.
  - The automatic replace retries at every app start while status is stale, the machine is supported, and the player didn't cancel that tag.
  - The downloading status carries `replacing: true` during a replace. The status stays stale with the old tag, which gives Auto its "updating" reason.

**The downloader.**
- The model downloader is one module-wide download with a Hugging Face–only allow-list. It becomes an instance per download, each with its own allow-list, cancel and progress channel. The model download keeps its behavior.
- The CUDA download's allow-list is the GitHub host; the redirect to GitHub's asset host follows from there.
- A CUDA download and a model download can run at the same time. Cancel on one never stops the other.
- CUDA progress uses its own channel, never the model download's.
- Partial files sit in a staging folder per tag, so the untagged cudart asset name can't mix two tags. A digest mismatch deletes the partial.

**The CUDA install module (main process).**
- Downloads both assets, checks each digest, unpacks, writes the marker, then moves the folder into place. The extractor is injected: Windows' own tar in the app, a zip reader in tests (CI runs on Linux).
- On a pin bump with CUDA installed, it starts the new tag's download in the background on the first app start.
- Before downloading, it checks free space for both zips plus the unpacked folder (Q20).
- It keeps the current tag and the newest older tag. Older folders are deleted when the engine is stopped or at app start (Q16, Q22).
- Remove asks to stop the engine, then deletes the folder. Cancel keeps the partials so the download can resume.
- A failure record (tag and driver version) lives on the device. Auto skips CUDA while it matches (Q19). Retry clears it.
- Interface: `status()` → not-installed / downloading (bytes, total) / installed (tag) / stale (old tag) / unsupported (reason). Also `install()`, `cancel()` and `remove()`.
- The renderer reads status through a desktop-bridge call, and a push event reports changes. The same status carries whether nvidia-smi found an NVIDIA card, so the panel doesn't depend on the VRAM poll.

**NVIDIA facts.**
- A separate nvidia-smi query, with a timeout, reads `driver_version` and `compute_cap`. The existing VRAM query stays as it is, so a driver that rejects a field can't make the Hardware tab or Auto's device pick read "no GPU".
- A failed or timed-out query means "CUDA support unknown". The row shows that reason and Auto stays on Vulkan.

**Eligibility (pure policy beside the device policy).**
- Inputs: the NVIDIA facts, the Vulkan device names main already lists for the picker, the Backend setting, the device setting, and the install status.
- Supported: compute capability 7.5 or higher. Floor: R580 for 8.6, 8.9, 12.0 and 12.1, which have precompiled code. R615 for every other supported capability, which runs from PTX.
- With several NVIDIA cards, every card must pass. Otherwise Auto stays on Vulkan, unless the device setting pins a card that passes.
- Mixed GPUs (Q14) means an NVIDIA card plus a non-NVIDIA card that isn't integrated. NVIDIA plus an integrated GPU, the common laptop case, is not mixed. The device policy's integrated-name test is shared for this.
- Output: the backend for this start, and a reason when CUDA is not used: not installed, updating, driver too old, card too old, support unknown, mixed GPUs, or setting.

**Backend choice at engine start.**
- The engine runs in a utility process and can't see user data. Main resolves the CUDA folder and passes the server binary in the start options.
- The Backend setting joins the options whose change reloads a running engine.
- Order for a CUDA start:
  1. List the CUDA build's devices. If none are listed, go to step 3.
  2. Load on CUDA. On success, stop here.
  3. List the Vulkan build's devices, and load on Vulkan. This is today's path, including its CPU fallback.
- The engine state already reports the backend that ran (`gpuBackend`), and the status line already labels CUDA. New fields: a fallback flag and the CUDA error. The notice and the Error Details show the CUDA error. If Vulkan fails too, the final error is Vulkan's, as today.
- The device picker lists the devices of the backend that will run. The pin stays a device name. On the 4090, the CUDA and Vulkan builds both list "NVIDIA GeForce RTX 4090", so a pin carries across. A name that doesn't match falls back to Auto, as the device policy already does.
- The engine spawns llama-server with a larger CUDA JIT cache, so RTX 20 and GTX 16 cards compile the kernels once. The value is `CUDA_CACHE_MAXSIZE=4294967296` (4 GiB), on CUDA starts only. Source: NVIDIA CUDA Programming Guide, section 5.2.2.3 `CUDA_CACHE_MAXSIZE` (https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/environment-variables.html, read 2026-11-07). It gives 1 GiB as the desktop default and 4 GiB as the maximum. That a full cache keeps the compiled kernels across starts is not verified on an RTX 20 card.

**Settings.**
- A new Backend setting, `auto | vulkan | cuda`, default `auto`. Like every setting, it lives on the device and never goes in backups, worlds or saves. No export shape changes.
- A "CUDA prompt seen" flag on the device.

**UI (Local Model panel, engine area).**
- On NVIDIA machines only:
  - A row with the download size, Download, progress, Cancel, Remove, the NVIDIA license line with the EULA link, and the reason text (driver too old, card too old).
  - The Backend control beside the device picker.
  - "Restart on CUDA" when CUDA landed while the engine runs on Vulkan (Q17).
  - "CUDA failed last time" with Retry (Q19).
- The one-time prompt is a main-menu notice on the first engine start with a supported card (Q18).
- A new pattern, such as the prompt's form, needs the user's approval before adoption (Design System rule).
- Final copy comes from the Writing Guide. The strings in this spec are working text.

**Credits.**
- A hand-written entry for cuBLAS, cuBLASLt and the CUDA runtime under the NVIDIA CUDA EULA. It goes beside the llama.cpp entry in the bundled-assets part of the third-party notices, which the notices generator doesn't touch.

## Testing Decisions

A good test drives a seam from outside and asserts what a player or the engine state would see. Tests never assert internals, and never shape a scenario so that a fallback can't fire. A test for a guard (digest, eligibility, fallback) must fail when its bug comes back.

1. **Engine start** through the engine factory and the fake llama-server:
   - Auto picks CUDA when it is installed and eligible.
   - Auto stays on Vulkan for mixed GPUs, an old driver, an old card, or no install.
   - The setting overrides Auto.
   - A CUDA failure falls back to Vulkan and the state shows the notice. A Vulkan failure still reaches the CPU fallback.
   - A device pin resolves across backends.
   - Prior art: the "CPU fallback and load errors" and "device listing" suites in the engine tests.
   - The fake server replays recorded runs only. A CUDA listing, a CUDA load and a CUDA load failure must be recorded on a real GPU with the fixture recorder. That needs a window from the user (GPU policy).
   - The fake must answer by binary, so one start can see CUDA and then Vulkan.
2. **CUDA install module**, with an injected fetch, an injected extractor and a temp data folder:
   - Download, resume, and Cancel. A model download running at the same time is untouched.
   - A digest mismatch is refused, the partial is deleted, and nothing is installed.
   - Unpack, marker, and status.
   - A pin bump runs the background replace while status reads stale, then deletes the old tag.
   - Remove.
   - Prior art: the model download and stream download tests.
3. **Local Model panel**:
   - The row shows on NVIDIA only and hides elsewhere.
   - Restart on CUDA, and the failed-last-time row with Retry.
   - The main-menu notice shows once on the first engine start with a supported card. It is tested through the main menu's tests, not the panel's.
   - CUDA is grayed out until installed.
   - The reason text appears for driver and card limits.
   - The fallback notice and the Error Details show.
   - Prior art: the Local Model panel tests (KV cache rows, Unified KV Cache row).
4. **Eligibility policy**:
   - Covered through seam 1. Table cases go there unless a pure-function test is clearly cheaper, as the device policy's tests are.
5. **Pin-bump command and build gate**:
   - The command writes the digests. The gate fails when CUDA assets are missing or a digest differs.
   - Prior art: the fetch script's existing test.
6. **NVIDIA facts query**:
   - A rejected field or a timeout gives "support unknown", and the VRAM rows stay intact.
7. **Manual checks for the user**:
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

**Steam.** The public Steamworks pages have no rule on runtime downloads from third-party hosts. The Steam Distribution Agreement itself was not checked. Both open legal points are item 8 of the Steam release checklist (Q23).

**Seen in passing, not part of this effort.** A Vulkan run printed "Flash Attention over K/V rows is assigned to device CPU". Whether the app's own `-fa on` start hits the same fallback is not checked.
