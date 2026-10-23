# 05: Unified KV Cache

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one new setting threaded through a well-worn path, plus copy.

## What to build

A **Unified KV Cache** setting, default on, in the Local Model panel under **Advanced** (spec: Settings → server arguments; Q3, Q5, Q15). On, the engine passes `--kv-unified` and `-c` Context Size: the parallel requests share one pool. Off, it passes `-c` Context Size × Parallel Requests without `--kv-unified`, so each request gets the full Context Size.

Thread it through the engine-setting path: the default, the validated persisted value, the `setOptions` IPC, the main process's boot options and reload diff, and the applied value in the engine status. The renderer default and the boot options stay equal. Rewrite the Parallel Requests copy and code comments to say what really happens to the context in both states. Help copy follows the writing guide.

## Acceptance criteria

- [x] Engine tests: on → `--kv-unified` and `-c` Context Size; off → `-c` Context Size × N, no `--kv-unified`. (`llmEngine.test.mjs` "Unified KV Cache …"; reinstated the bug once, the off test failed)
- [x] Panel tests: the row shows in Advanced only, arms Save & Reload when it differs from the applied value, and Reset restores on. (`LocalModelPanel.test.tsx` "Unified KV Cache row")
- [x] A fresh start with defaults doesn't reload. (renderer `DEFAULT_LOCAL_UNIFIED_KV_CACHE` and `main.cjs` boot `unifiedKvCache` are both true; the panel test "stays disarmed" reads the applied true)
- [x] The Parallel Requests copy matches both states; `copy-sweep` passes on the new and changed rows. (`npm run copy:sweep` raised no notice on the new or changed rows)
- [x] Changelog fragment in `docs-internal/changelog.d/`, naming the new default and what to turn off for a full context per request.

## Landed

**Not verified**
- Real binary: no run of `llama-server` with `--kv-unified` on or off. The load matrix (seam 3) covers it.

**For you**
- Local Model panel, Advanced: read the **Unified KV Cache** row and the Parallel Requests slider text ("2 · share 8,192 tok" on, "2 · 8,192 tok each" off).
