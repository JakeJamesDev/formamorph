# 03 — Baseline before-capture

**What to build:** The "before" evidence for the conversion: one `npm run baseline` Sedge Landing run against the unmodified request path, with the AI-context dumps preserved and their location recorded here for ticket 04 to compare against. Needs a local model server per the harness docs.

**Blocked by:** None — can start immediately.

Status: done

- [x] Baseline run completes on unmodified code
- [x] AI-context dumps kept and their path recorded in this ticket's Comments

## Comments

**Before-capture, 2026-08-13.** Ran at commit `de30c45` ("Fix The AI Stream Abort Path") with a clean
working tree — the AI Stream module exists but GameViewer still owns the request path, i.e. the
pre-conversion state ticket 04 changes.

| | |
|---|---|
| Dump | `testing/baseline/runs/A-cydonia-lmstudio-2026-08-13T07-15-52-213Z.json` (gitignored — do not delete) |
| Result | 7/7 turns |
| Arm | LM Studio `cydonia-24b-v4.3@q4_k_m` via `http://127.0.0.1:1234/v1/chat/completions` |
| Profile | A (Sedge Landing) |

Replay command for ticket 04's after-capture — same arm, same profile, nothing else loaded in LM Studio:

```bash
npm run baseline -- --profile A --model cydonia-lmstudio
```

Output is nondeterministic by design; compare AI-context *shape* (turn count, request bodies, field
presence/absence, sampler values, endpoint routing), not prose.
