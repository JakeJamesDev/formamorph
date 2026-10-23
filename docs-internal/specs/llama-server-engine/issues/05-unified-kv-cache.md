# 05: Unified KV Cache

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one new setting threaded through a well-worn path, plus copy.

## What to build

A **Unified KV Cache** setting, default on, in the Local Model panel under **Advanced** (spec: Settings → server arguments; Q3, Q5, Q15). On, the engine passes `--kv-unified` and `-c` Context Size: the parallel requests share one pool. Off, it passes `-c` Context Size × Parallel Requests without `--kv-unified`, so each request gets the full Context Size.

Thread it through the engine-setting path: the default, the validated persisted value, the `setOptions` IPC, the main process's boot options and reload diff, and the applied value in the engine status. The renderer default and the boot options stay equal. Rewrite the Parallel Requests copy and code comments to say what really happens to the context in both states. Help copy follows the writing guide.

## Acceptance criteria

- [ ] Engine tests: on → `--kv-unified` and `-c` Context Size; off → `-c` Context Size × N, no `--kv-unified`.
- [ ] Panel tests: the row shows in Advanced only, arms Save & Reload when it differs from the applied value, and Reset restores on.
- [ ] A fresh start with defaults doesn't reload.
- [ ] The Parallel Requests copy matches both states; `copy-sweep` passes on the new and changed rows.
- [ ] Changelog fragment in `docs-internal/changelog.d/`, naming the new default and what to turn off for a full context per request.
