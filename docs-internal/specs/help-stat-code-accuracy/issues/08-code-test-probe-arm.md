# 08: Code Test Probe Arm

Status: ready-for-agent
Blocked by: 06 — Code Test Function; 07 — Code Probe Cases And Bar
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a local-model probe that needs the GPU; the user must agree a window first.

## What to build

The code test function is measured: Quick Reference plus the function against Quick Reference alone, on a local tool-calling model (Cydonia 24B on LM Studio), using the five cases from ticket 07 at 5 or more runs per arm with `reasoning_effort: "none"`. The run happens in a GPU window the user agrees to; it never starts mid-session. On a gain, the setting's default stays on. On no gain, the default flips to off. The spec records the numbers either way.

## Acceptance criteria

- [ ] Before any run, check what LM Studio has loaded and ask the user for a window
- [ ] Both arms run on the same model with an in-batch control, 5+ runs per case
- [ ] The five cases from 07 are re-measured against the Q9 bar, with the persona case called out (Q29)
- [ ] Numbers recorded in the spec with the default decision
- [ ] Setting default matches the decision; changelog fragment written if it flips
