# 03: Dialogue-Led Narration Prompt

Status: ready-for-agent
Status note: waits on ticket 07; no work started, so the claim and its `Base:` line are released
Blocked by: 02, 07
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

Open Chat supplies its own narration prompt. The narrator stays in second person, but each reply centers the speech and actions of the entity. The entity is written in third person and addresses the player as "you", the same frame as an imported SillyTavern greeting.

Start from the built-in narration prompt and keep every chip: memory, persona, dictionary, language, and the rest. Change only the voice rules. The prompt reads the four tone chips from ticket 02. Several picked entities must still work, with no turn-taking rules. Sampler pins stay as they are.

Read the prompt-writing guide before editing. Follow it: positive contract, generic examples only, no parrotable values.

## Acceptance criteria

- [ ] The override is present and enabled on the world, and the per-world opt-out still restores the preset of the player
- [ ] Every chip in the built-in narration prompt is present in the override
- [ ] A/B probe against the built-in prompt on both reference tiers, at least 2 runs per case, one imported card as the fixture
- [ ] Metrics with before and after numbers are recorded under Comments: dialogue share of the reply, second-person frame held, reply length per Reply Length setting
- [ ] The regression check from the guide passes on the other metrics
- [ ] An imported greeting as page one, followed by one turn, keeps one frame, checked live
- [ ] The world system prompt holds one neutral line with no premise (the entities present and the player set the scene), probed together with the override
- [ ] The AI description of the one location, written unprobed in ticket 01, is in the probed context; keep it or rewrite it on the numbers
- [ ] The content test asserts the narration override is present and reads all four tone chips, and its finding set no longer holds world-empty-system-prompt
- [ ] Four gates green

## Comments

**From ticket 02.** The four tone chips sit in the world system prompt, so `world-empty-system-prompt` is already gone from the finding set. When this ticket moves the chips into the narration override, keep one neutral line in the system prompt, or the finding returns. Also point the tone test in `src/lib/openChatWorld.test.ts` (`toneText`) at the override text.

**Blocked on the engine, 2026-09-21.** A placeholder chip typed in a world custom prompt reaches the model raw. The pipeline resolves placeholders in chip values only, and the **Custom Prompts** field knows prompt chips only. A throwaway test through `buildNarrationPrompt` proved it. The user ruled: build engine and editor support first, as ticket 07. The alternative was to keep the tone chips in the world system prompt, which also sends them to the six other prompts that carry `<WORLD DESCRIPTION>`.

Notes for the next session:

- The built-in prompt carries `<LENGTH GUIDANCE>`, a player setting. The Reply Length chip gives a second length instruction. Keep both chips per the criteria, and probe the pair: the guide says models write up to the stated number.
- `world-narration-probe.mjs` is the base for the A/B probe. It assembles a bundled world by hand, so it needs an arm for the override text and an entity fixture from one imported card.
- The guide and the probe skill name the cloud default endpoint and Cydonia 24B as the current test pair, with about 12 cloud runs per arm. LM Studio listed `cydonia-24b-v4.3@q4_k_m` on this date.
- The tone test should resolve the rendered narration prompt, not the raw override string, so it also guards the seam from ticket 07.
