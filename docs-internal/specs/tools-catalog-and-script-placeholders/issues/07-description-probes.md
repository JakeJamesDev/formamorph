# 07: Description Probes

Status: ready-for-agent
Blocked by: 02, 03, 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: judging call rates and narration use across two model tiers and several arms; needs the local model servers up.

## What to build

Each new built-in description has probe numbers on both model tiers, at least two runs per case, per the prompt-writing guide. The lookup probes measure whether the AI calls the Tool for a location or a lore entry and uses the result. The roll probe measures whether the AI calls roll on a chance outcome and follows the total. The recall probe uses a long playthrough with a dropped event the story returns to, runs with Semantic Memory off and on, and measures calls, use of the fetched fact, and any repeated-scene freeze. The numbers are filed in this ticket. Switching any Tool on by default stays a user call.

## Acceptance criteria

- [ ] Probe scripts under the baseline harness, one per Tool, reusable
- [ ] Both tiers, two or more runs per case, before/after metrics and an other-metric regression check
- [ ] Recall on-arm finds at least what the off-arm finds, plus oblique-wording cases from the semantic memory A/B fixture
- [ ] Numbers and any description edits recorded here; description edits also land in the catalog with tests green
- [ ] No default switch flipped
