# Role and context only

The user requested a stronger ablation: explain only the narration role and perspective, then supply the context chips. The complete instruction is:

> You are the narrator of an interactive story. Narrate what happens in response to the player's action in second person, present tense.

Keep the world, lore, stats, traits, persona, notes, locations, and entity context chips in their existing order. Remove the guidelines, formatting and language directives, preparation, output contract, and system retrieval requirement. The fixture's empty chips remain empty. Preserve the ordinary player-action message and tool history. The `request_info` tool still exists with its unchanged description, which itself explains retrieval; this is a minimal **system instruction**, not an instruction-free request.

Compare against the saved [decision-notes batch](decision-notes-findings.md): six scenarios, seeds 424243/424244, same model and loaded metadata, thinking enabled, ordinary narration, automatic tool choice, 1,024-token response cap, four rounds, four lookups, and 180-second timeout. Verify cached request equality, exact rendered context preservation, and all nonsystem request fields before inference. Stop on infrastructure failure. Preserve failed trials without retries or cap increases.

This removes several instruction groups together to test the user's broad hypothesis, not isolate a single sentence's causal effect. Paragraph count, dialogue, names, and stylistic changes are observations, not automatic failures against rules deliberately removed from the candidate. Delivery, lore availability, canon consistency, lookup accuracy, reasoning tokens, drafting, and latency remain useful diagnostics. The user's subjective assessment of prose is central.

Publish all twelve output pairs verbatim with their player actions, labeled “Previous prompt” and “Minimal prompt,” in a narration-only comparison. Include partial output if a response hits its cap, clearly labeled. Keep full thinking traces and tool calls in a separate document; keep measurements and the complete minimal rendered prompt separate as well. Avoid selecting only attractive examples. Application prompts remain unchanged.

Run `node node_modules/vite-node/vite-node.mjs testing/baseline/harness/narration-experimental.cli.ts <saved-decision-notes-batch.json> --role-only --run`. Omit `--run` for offline preparation.
