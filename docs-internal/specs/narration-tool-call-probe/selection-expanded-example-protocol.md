# Example reasoning style, narration fixed

Compare the saved concise demonstration with an expanded inventory-and-planning demonstration. Only the two assistant `reasoning_content` fields change. The demonstration's user message, calls, full returned entry, and final narration remain identical. No new facts are added by the expanded reasoning.

Keep example placement, real-scene reasoning omission, first-response replay, model metadata, six scenarios, seeds 424243/424244, thinking enabled, and existing limits unchanged. Run ten new continuations; retain two no-lookup cases as unchanged controls. Compare entire first-continuation requests after removing reasoning fields to establish the boundary.

Inspect structure as well as length: action restatement, state/entity inventories, redundant plans, productive application of retrieved facts, drafting, and duplicate calls. Also inspect narration length, coverage, fidelity, and example leakage. This tests a combined change in reasoning style and length, not an isolated wording effect or persistence across player turns.

Preserve complete prompts, authored reasoning blocks, model thinking, narration, and request evidence. Run `narration-reasoning-replay.cli.ts --expanded-example --run` with vite-node. No production changes, retries, cap increases, or broader-model runs.
