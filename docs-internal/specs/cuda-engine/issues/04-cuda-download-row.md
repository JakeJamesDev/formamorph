# 04: CUDA Download Row

Status: ready-for-agent
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

- [ ] The row shows on a machine whose nvidia-smi lists an NVIDIA card, and is absent otherwise. (Local Model panel test)
- [ ] An unsupported machine sees the reason, with the driver-update hint for a driver under the floor, and no Download.
- [ ] Download → progress → installed, driven through the install module with an injected fetch, an injected extractor and a temp folder.
- [ ] Cancel keeps the partials, and the next Download resumes from them.
- [ ] A digest mismatch installs nothing and deletes the partial.
- [ ] Too little free space refuses the download, and the row states how much is needed.
- [ ] Remove while the engine runs asks first, stops the engine, then deletes the folder. Remove while stopped deletes at once.
- [ ] A model download running at the same time is untouched by the CUDA download and its Cancel.
- [ ] The license line and the EULA link render, and the Credits entry exists.
- [ ] Frames: `.scratch/frames/cuda-row-supported.png`, `.scratch/frames/cuda-row-downloading.png` and `.scratch/frames/cuda-row-unsupported.png`, each in light and dark, at the panel's realistic width.

For you: download CUDA for real on the 4090 through the row, and check that the size and progress read correctly. Local Model panel, engine area.
