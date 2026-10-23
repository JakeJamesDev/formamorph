# 12: Remove node-llama-cpp

Status: ready-for-agent
Blocked by: 09, 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a removal across dependencies, packaging and dead code, with the full gates and a packaged rerun.

## What to build

node-llama-cpp leaves the app (spec: Binaries; Q1). Remove the dependency, its prebuilt packages, its packaging rules, and every code path and test that only served it. Update comments and docs that name it. The branch is then ready to merge to main.

## Acceptance criteria

- [ ] No `node-llama-cpp` import, dependency or packaging rule remains.
- [ ] The four gates are green on the branch.
- [ ] The packaged-build smoke test from ticket 09 passes again after the removal.
- [ ] The installer size before and after is in the landing.
- [ ] Changelog fragment in `docs-internal/changelog.d/`.

For you: at the merge to main, add step 4d from the spec folder's `release-step-4d.md` to the release skill, right before "## 5. Gates". The skill folder is untracked, so the ticket can't carry it.
