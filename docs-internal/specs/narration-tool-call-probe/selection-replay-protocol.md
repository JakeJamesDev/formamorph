# Reasoning replay ablation

Compare the latest appearance-prerequisite candidate with identical tool-call continuations that omit previous assistant `reasoning_content` and `reasoning` fields. Preserve assistant content, native calls, correlated tool results, prompts, model metadata, seeds, and limits. Thinking remains enabled for new responses.

Reuse each saved first response so selection and pre-lookup reasoning are identical. The two quiet cases have no continuation and are reused controls, not independent reruns. Run the ten cases with lookups through the real trial loop. Additional tool calls remain possible under the existing limits.

Verify the first continuation differs from its saved counterpart only by removing reasoning fields. Preserve original responses in evidence. Check server-reported input tokens to establish whether omission changes effective input, without claiming exact knowledge of the server's rendered template.

Review interpretation, entity selection, application of newly retrieved facts, redundant action/state summaries, duplicate lookups, and complete prose drafting separately. Report pre-lookup tokens as fixed by construction. Compare post-lookup reasoning, completion, entity coverage, and factual fidelity; lower token counts alone are not success.

Run `narration-reasoning-replay.cli.ts --run` with vite-node. No production edits, prompt wording changes, model switches, retries, cap increases, or multi-turn generalization.
