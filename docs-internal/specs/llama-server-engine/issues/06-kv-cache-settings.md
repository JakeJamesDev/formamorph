# 06: KV Cache Settings

Status: ready-for-agent
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

- [ ] Engine tests: each value produces its server argument, and the applied values show in the status.
- [ ] Panel tests: the rows show in Advanced only; a quantized V cache with Flash Attention off can't be applied; Reset restores the defaults.
- [ ] A fresh start with defaults doesn't reload.
- [ ] On this PC, Q8_0 for K and V loads and answers, and the Formamorph share drops against F16 (numbers in the landing).
- [ ] On this PC, KV Cache in RAM loads and answers, and the share drops by about the KV size.
- [ ] `copy-sweep` passes on the new rows.
- [ ] Changelog fragment in `docs-internal/changelog.d/`.

For you: try a long context with Q8_0 and check the story still reads well.
