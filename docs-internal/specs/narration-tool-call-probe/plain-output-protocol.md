# Ordinary narration diagnostic

Run variant A only: the unchanged Experimental prompt with `request_info` as its sole tool. Remove the `write` definition and accept ordinary assistant narration. Experimental already specifies ordinary output when `write` is unavailable; do not change either prompt message or the lookup description.

Use the six existing scenarios at seeds 424243 and 424244, matching the [Experimental batch](experimental-findings.md). Reuse those twelve saved trials as the comparison. Keep thinking enabled, automatic tool choice, the 1,024-token cap, four request rounds, four lookups, and a 180-second request timeout. Keep authored summaries, cached descriptions, actions, model, and omitted sampler fields unchanged.

Before inference, verify every saved request against fresh Experimental preparation. The new request must differ only by removal of the `write` tool. Require the loaded-model metadata to match the saved batch. Stop on infrastructure failure and retain every completed trial, including failures. Do not retry or increase the cap.

Score delivery separately from lore availability and task quality. Ordinary output succeeds mechanically only when it contains nonempty content, no pending tool calls, and `finish_reason: stop`; cap exhaustion remains a failure even if some prose was emitted. Calls to the removed `write` function are failures. Review the outputs for tool-call text masquerading as prose, missing required or portrayed lore, canon errors, unwanted interaction, and repeated drafting.

Compare delivery, retrieval, grounded completion, restraint, truncation, paragraph count, and timing with the cached batch. Also report completed prose that the old `write` contract rejected, so relaxing the acceptance condition is not mistaken for better generation. One model and two seeds per scene remain diagnostic evidence, not a reliability estimate.

Run `node node_modules/vite-node/vite-node.mjs testing/baseline/harness/narration-experimental.cli.ts <saved-experimental-batch.json> --plain --run`. Omit `--run` for offline preparation. Variant B's explicit retrieval contract is deferred until this result is reviewed.
