# 12: Remove node-llama-cpp

Status: done
Blocked by: 09, 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a removal across dependencies, packaging and dead code, with the full gates and a packaged rerun.

## What to build

node-llama-cpp leaves the app (spec: Binaries; Q1). Remove the dependency, its prebuilt packages, its packaging rules, and every code path and test that only served it. Update comments and docs that name it. The branch is then ready to merge to main.

## Acceptance criteria

- [x] No `node-llama-cpp` import, dependency or packaging rule remains. (`git grep` finds the name only in changelog history, dated notes, specs and one dated line of the thinking-modes memo; the lockfile drops 107 packages with no version changes)
- [x] The four gates are green on the branch. (typecheck and changed lint in review; prepare runs all four and lands only on green)
- [x] The packaged-build smoke test from ticket 09 passes again after the removal. (`smoke.mjs`: engine ready on Vulkan, 3541 MiB, chat HTTP 200; `afterQuit.mjs`: PASS, no `llama-server`, 13 MiB over the 2138 MiB baseline)
- [x] The installer size before and after is in the landing. (below)
- [x] Changelog fragment in `docs-internal/changelog.d/`.

For you: at the merge to main, add step 4d from the spec folder's `release-step-4d.md` to the release skill, right before "## 5. Gates". The skill folder is untracked, so the ticket can't carry it.

## Landed

Windows payload (`release/win-unpacked`, built at Base and after the removal):

| Build | Payload | Zip (deflate 6) |
|---|---|---|
| Base `c8ce7a8e5` | 583,886,073 B (556.8 MiB) | 231,230,236 B (220.5 MiB) |
| After removal | 579,529,116 B (552.7 MiB) | 230,073,436 B (219.4 MiB) |

The drop is small because the Base build already shipped no `@node-llama-cpp/*` prebuilt, only the 6 MB core package and its JS dependencies. `app.asar` lists 833 `node_modules` entries, down from 1737, and `app.asar.unpacked` is gone.

**Not verified**
- The CI-assembled Windows installer (launcher plus payload), macOS and Linux builds: only the Windows `dir` payload was built here.

**For you**
- At the merge to main, add step 4d from the spec folder's `release-step-4d.md` to the release skill, right before "## 5. Gates". The skill folder is untracked, so the ticket can't carry it.
- Main's `node_modules` still holds node-llama-cpp until the merge. Run `npm install` on main after the merge to prune it.
