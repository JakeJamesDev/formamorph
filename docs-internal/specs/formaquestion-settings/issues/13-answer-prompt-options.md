# 13: Answer prompt options

Status: done
Base: abd4cf3b
Blocked by: 02, 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The answer prompt gets an Options panel on the Prompts tab, with the shared fields from ticket 02 (Q43).

| Field | Default |
|---|---|
| Temperature | 0.2 |
| Repetition penalty | 1 |
| Max Output | 800 tokens |

- The values belong to the help preset (Q58, which reverses Q10 for them). The Default preset shows them read-only, with the notice and **Duplicate & Edit**, and a duplicate copies them.
- The Options show as a row nested under Answer in the Prompts rail.
- The answer request reads the active preset's values. The pick request keeps its pinned values and its own cap.
- Today both requests send as the `help` kind and take the same sampler pin, and an AI call has a cap override but no sampler override. This ticket adds the samplers to the preset and a call-level sampler override, which the answer request uses. The `help` pin stays for the pick request (Q50).

The Prompts docs section gains the panel.

Recommended model rationale: three fields on existing components and one read in the help session.

## Acceptance criteria

- [x] Each field changes the answer request body, and does not change the pick request.
- [x] With the defaults, the request bodies equal those of ticket 11.
- [x] Each preset keeps its own values, and the Default preset refuses edits.
- [x] A bad stored value falls back to the default.
- [x] A changelog line is in In Progress.
- [x] The four gates are green.
