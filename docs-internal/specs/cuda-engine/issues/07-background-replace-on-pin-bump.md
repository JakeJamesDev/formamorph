# 07: Background Replace On Pin Bump

Status: ready-for-human
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: state across app versions, deletes that must wait for locked DLLs, and launcher rollback.

## What to build

When an app update moves the llama.cpp pin, a player with CUDA installed keeps CUDA without doing anything. On the first app start after the update, the install status reads stale and the new tag's CUDA build downloads in the background, with the free-space check (Q7, Q20). While it downloads, the engine runs on Vulkan and the row shows the "updating" reason. When it lands, the next engine start uses CUDA. Nothing reloads mid-play (Q17).

The app keeps the folders for the current tag and the newest older tag, so a launcher rollback finds its folder (Q22). Older folders are deleted only while the engine is stopped or at app start, without a prompt (Q16).

The changelog fragment, if any, is folded into the CUDA entry when that is still unreleased.

## Acceptance criteria

- [x] With an older tag installed, app start reports stale and starts the new tag's download without a click. (install module test with a temp folder) (`cudaInstall.test.mjs` "with an older tag installed, app start reads stale…"; every downloading status carries `replacing`)
- [ ] During the replace, Auto starts on Vulkan and the reason reads "updating".
- [x] After the replace lands, the newest older tag is kept and anything older is deleted. ("after the replace lands, keeps the newest older tag…"; keeping no other tag turned it and 7 more red)
- [x] A delete is deferred while the engine runs, and happens at the next stop or app start. ("defers deletes while the engine runs…"; dropping the `engineRunning()` check turned it red)
- [x] A rollback to the previous tag finds its folder valid and downloads nothing. ("a rollback to the previous tag finds its folder valid…": zero requests, the newer folder kept)
- [x] Too little free space leaves the engine on Vulkan, and the row states how much is needed. (module "too little free space leaves the old build in place…"; panel "a stale install that couldn't fit…")

## Landed

**Not verified**
- During the replace, Auto starts on Vulkan and the reason reads "updating": ticket 05 owns the backend choice and maps `stale`, or `downloading` with `replacing`, to "updating". This ticket ships the status side and the row's hint ("says CUDA is updating while a replace downloads…").
- The real main-process path: the app-start call, the engine-stop prune and Windows' refusal to move a held folder were not run in Electron.

**For you**
- After the next pin bump, start the app with CUDA installed and watch the CUDA row download the new files on its own. Local Model panel, engine area.
- Spec-session rulings applied: keep the current tag plus the newest other valid folder, older or newer; a Cancel is recorded against the tag and stops the automatic retry until Download or Resume; only a newer pin clears it.
