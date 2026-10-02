# 13: Answer prompt options

Status: ready-for-agent
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

- The values are device settings that apply to every help preset (Q10). The panel says so, because gameplay Options belong to a preset.
- The Default preset does not lock them.
- The answer request reads them. The pick request keeps its pinned values and its own cap.

The Prompts docs section gains the panel.

Recommended model rationale: three fields on existing components and one read in the help session.

## Acceptance criteria

- [ ] Each field changes the answer request body, and does not change the pick request.
- [ ] With the defaults, the request bodies equal those of ticket 11.
- [ ] The values stay when the player changes the help preset.
- [ ] A bad stored value falls back to the default.
- [ ] A changelog line is in In Progress.
- [ ] The four gates are green.
