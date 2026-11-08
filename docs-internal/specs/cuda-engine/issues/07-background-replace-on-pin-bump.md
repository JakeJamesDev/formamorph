# 07: Background Replace On Pin Bump

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: state across app versions, deletes that must wait for locked DLLs, and launcher rollback.

## What to build

When an app update moves the llama.cpp pin, a player with CUDA installed keeps CUDA without doing anything. On the first app start after the update, the install status reads stale and the new tag's CUDA build downloads in the background, with the free-space check (Q7, Q20). While it downloads, the engine runs on Vulkan and the row shows the "updating" reason. When it lands, the next engine start uses CUDA. Nothing reloads mid-play (Q17).

The app keeps the folders for the current tag and the newest older tag, so a launcher rollback finds its folder (Q22). Older folders are deleted only while the engine is stopped or at app start, without a prompt (Q16).

The changelog fragment, if any, is folded into the CUDA entry when that is still unreleased.

## Acceptance criteria

- [ ] With an older tag installed, app start reports stale and starts the new tag's download without a click. (install module test with a temp folder)
- [ ] During the replace, Auto starts on Vulkan and the reason reads "updating".
- [ ] After the replace lands, the newest older tag is kept and anything older is deleted.
- [ ] A delete is deferred while the engine runs, and happens at the next stop or app start.
- [ ] A rollback to the previous tag finds its folder valid and downloads nothing.
- [ ] Too little free space leaves the engine on Vulkan, and the row states how much is needed.
