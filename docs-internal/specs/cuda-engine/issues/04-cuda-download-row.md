# 04: CUDA Download Row

Status: done
Blocked by: 01, 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: a new main-process module with file swaps, free-space and digest guards, a bridge and push event, and the first UI for the effort.

## What to build

On a machine with an NVIDIA card, the Local Model panel's engine area shows a CUDA row. It shows the download size, the support reason from ticket 03 when the machine is unsupported, and a line saying the files are NVIDIA's CUDA libraries under NVIDIA's license, with a link to the CUDA EULA. A supported player clicks Download, sees progress, can Cancel and later resume, and ends with CUDA installed. Remove asks to stop the engine when it runs, then deletes the folder. The engine still runs on Vulkan in this ticket. Ticket 05 makes it use CUDA.

The CUDA install module uses a downloader instance from ticket 01, and the pin data and URLs from ticket 02. It checks free space for both zips plus the unpacked folder before it starts (Q20). It keeps partials in a staging folder per tag, checks each digest, and deletes the partial on a mismatch. It unpacks through an injected extractor (Windows' own tar in the app), writes the marker, and moves the folder into the engines folder under user data. Status (not-installed / downloading / installed / stale / unsupported) reaches the renderer through a desktop-bridge call and a push event, with the support result from ticket 03. This ticket owns that status bridge; tickets 07 and 08 extend it.

Credits: a hand-written entry for cuBLAS, cuBLASLt and the CUDA runtime under the NVIDIA CUDA EULA, beside the llama.cpp entry in the bundled-assets part of the third-party notices.

Copy follows the Writing Guide. Changelog fragment under 👤 Added.

## Acceptance criteria

- [x] The row shows on a machine whose nvidia-smi lists an NVIDIA card, and is absent otherwise. (Local Model panel test) (`shows on a machine whose nvidia-smi lists…`, `is absent when nvidia-smi lists no NVIDIA card`; dropping the `nvidia` check turned the second red)
- [x] An unsupported machine sees the reason, with the driver-update hint for a driver under the floor, and no Download. (`tells a driver under the floor to update…`, `states the card-too-old / support-unknown reason`)
- [x] Download → progress → installed, driven through the install module with an injected fetch, an injected extractor and a temp folder. (`cudaInstall.test.mjs` "downloads both assets…", a real range server and fflate extractor)
- [x] Cancel keeps the partials, and the next Download resumes from them. ("Cancel keeps the partials…": the resume never asks for asset 1 or the done ranges; "a Cancel that lands between the two assets…")
- [x] A digest mismatch installs nothing and deletes the partial. ("a digest mismatch…"; disabling the check turned it red)
- [x] Too little free space refuses the download, and the row states how much is needed. (module "refuses to start without room…", panel "states how much space…"; dropping the unpacked size from the need turned it red)
- [x] Remove while the engine runs asks first, stops the engine, then deletes the folder. Remove while stopped deletes at once. (panel "asks before Remove…", "removes at once…"; module "Remove stops the engine before it deletes the folder")
- [x] A model download running at the same time is untouched by the CUDA download and its Cancel. (module "a model download running at the same time…")
- [x] The license line and the EULA link render, and the Credits entry exists. (panel test reads the line and the link `href`; "NVIDIA CUDA libraries" in `THIRD-PARTY-NOTICES.md`)
- [x] Frames: `.scratch/frames/cuda-row-supported.png`, `.scratch/frames/cuda-row-downloading.png` and `.scratch/frames/cuda-row-unsupported.png`, each in light and dark, at the panel's realistic width. (headless Chrome with a pre-boot desktop shim, 1280×900; dark ones end in `-dark`)

## Landed

**Not verified**
- The real main-process path: the bridge, Windows' tar extractor, `statfs` on the engines folder and GitHub's redirect to its asset host were not run in Electron.

**For you**
- For you: download CUDA for real on the 4090 through the row, and check that the size and progress read correctly. Local Model panel, engine area.
- Frames: `.scratch/cuda-engine-04/frames/cuda-row-supported.png`, `.scratch/cuda-engine-04/frames/cuda-row-downloading.png`, `.scratch/cuda-engine-04/frames/cuda-row-unsupported.png`, plus each `-dark` twin.
- The pin now carries each asset's `size` and `unpackedSize`; `npm run llama-server:bump` writes them, and the CUDA check fails a pin without them.
