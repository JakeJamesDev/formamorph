# 06: KV Cache Settings

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: three settings on the same path as ticket 05, plus one cross-setting rule.

## What to build

Three settings in the Local Model panel under **Advanced** (spec: Settings → server arguments; Q7, Q11):

- **K Cache Type**: F16 (default), Q8_0, Q4_0 → `-ctk`.
- **V Cache Type**: F16 (default), Q8_0, Q4_0 → `-ctv`. A quantized V cache requires Flash Attention on. The panel turns Flash Attention on with it, or blocks the choice while Flash Attention is off. The design-system skill picks the control; a new pattern needs the user's approval.
- **KV Cache in RAM**: default off → `-nkvo` when on. It keeps the context in system RAM so the model's weights get the VRAM.

Thread each through the engine-setting path the same way ticket 05 does. Each ticket adds only its own fields.

## Acceptance criteria

- [x] Engine tests: each value produces its server argument, and the applied values show in the status. (`llmEngine.test.mjs` "K and V Cache Type …", "KV Cache in RAM …"; reinstated the bugs once, the panel and engine guards failed)
- [x] Panel tests: the rows show in Advanced only; a quantized V cache with Flash Attention off can't be applied; Reset restores the defaults. (`LocalModelPanel.test.tsx` "local model KV cache rows")
- [x] A fresh start with defaults doesn't reload. (renderer defaults f16/f16/off equal the `main.cjs` boot options; the "stay disarmed" test reads the applied defaults)
- [x] On this PC, Q8_0 for K and V loads and answers, and the Formamorph share drops against F16 (numbers in the landing). (Impish 4B Q4_K_M, 32768 context, 1 slot: VRAM delta 6650 MB F16, 4732 MB Q8_0 for K and V, down 1918 MB; answered)
- [x] On this PC, KV Cache in RAM loads and answers, and the share drops by about the KV size. (same model: 2640 MB with the KV cache in RAM, down 4010 MB; answered)
- [x] `copy-sweep` passes on the new rows. (`npm run copy:sweep` raised no notice on the new rows)
- [x] Changelog fragment in `docs-internal/changelog.d/`.

For you: try a long context with Q8_0 and check the story still reads well.

## Landed

**Rulings** (spec T06-1 to T06-3)
- A setting never silently changes another. With Flash Attention off, the Q8_0 and Q4_0 V options are disabled with a hint. With V quantized, the Flash Attention box is disabled with a hint.
- Main and the engine coerce a quantized V cache with Flash Attention off to F16, so a stale value can't fail a load.
- K and V use the existing select, KV Cache in RAM a CheckRow. Stored as `'f16' | 'q8_0' | 'q4_0'` (invalid → f16) and a boolean.

**Not verified**
- The pinned `llama-server` isn't fetched on this PC. The runs used LM Studio's Vulkan build 2.40.0 (`llama-server` 0.4.1-dev) through the engine. Its log lines gave no Formamorph share (`engineVramMB` null), so the numbers above are nvidia-smi deltas. The load matrix (seam 3) covers the pinned build.
- The long-context story check ("For you" above) is yours.

**For you**
- Local Model panel, Advanced: read **K Cache Type**, **V Cache Type** and **KV Cache in RAM**. Pick Q8_0 for V, then try to turn **Flash Attention** off (blocked). Turn Flash Attention off first and the Q8_0 and Q4_0 V options are blocked.
- Load a long context with Q8_0 and read the story.
