# 03: Dialogue-Led Narration Prompt

Status: in-progress
Base: e48a6ca5
Blocked by: 02, 07
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

Open Chat supplies its own narration prompt. The narrator stays in second person, but each reply centers the speech and actions of the entity. The entity is written in third person and addresses the player as "you", the same frame as an imported SillyTavern greeting.

Start from the built-in narration prompt and keep every chip: memory, persona, dictionary, language, and the rest. Change only the voice rules. The prompt reads the four tone chips from ticket 02. Several picked entities must still work, with no turn-taking rules. Sampler pins stay as they are.

Read the prompt-writing guide before editing. Follow it: positive contract, generic examples only, no parrotable values.

## Acceptance criteria

- [x] The override is present and enabled on the world, and the per-world opt-out still restores the preset of the player
- [x] Every chip in the built-in narration prompt is present in the override
- [x] A/B probe against the built-in prompt on both reference tiers, at least 2 runs per case, one imported card as the fixture
- [x] Metrics with before and after numbers are recorded under Comments: dialogue share of the reply, second-person frame held, reply length per Reply Length setting
- [ ] The regression check from the guide passes on the other metrics — **one guard fails on the cloud tier; see "Open: the empty room" under Comments**
- [x] An imported greeting as page one, followed by one turn, keeps one frame, checked live
- [x] The world system prompt holds one neutral line with no premise (the entities present and the player set the scene), probed together with the override
- [x] The AI description of the one location, written unprobed in ticket 01, is in the probed context; keep it or rewrite it on the numbers
- [x] The content test asserts the narration override is present and reads all four tone chips, and its finding set no longer holds world-empty-system-prompt
- [x] Four gates green

## Comments

**From ticket 02.** The four tone chips sit in the world system prompt, so `world-empty-system-prompt` is already gone from the finding set. When this ticket moves the chips into the narration override, keep one neutral line in the system prompt, or the finding returns. Also point the tone test in `src/lib/openChatWorld.test.ts` (`toneText`) at the override text.

**Blocked on the engine, 2026-09-21.** A placeholder chip typed in a world custom prompt reaches the model raw. The pipeline resolves placeholders in chip values only, and the **Custom Prompts** field knows prompt chips only. A throwaway test through `buildNarrationPrompt` proved it. The user ruled: build engine and editor support first, as ticket 07. The alternative was to keep the tone chips in the world system prompt, which also sends them to the six other prompts that carry `<WORLD DESCRIPTION>`.

Notes for the next session:

- The built-in prompt carries `<LENGTH GUIDANCE>`, a player setting. The Reply Length chip gives a second length instruction. Keep both chips per the criteria, and probe the pair: the guide says models write up to the stated number.
- `world-narration-probe.mjs` is the base for the A/B probe. It assembles a bundled world by hand, so it needs an arm for the override text and an entity fixture from one imported card.
- The guide and the probe skill name the cloud default endpoint and Cydonia 24B as the current test pair, with about 12 cloud runs per arm. LM Studio listed `cydonia-24b-v4.3@q4_k_m` on this date.
- The tone test should resolve the rendered narration prompt, not the raw override string, so it also guards the seam from ticket 07.

**2026-09-21, what shipped.**

- The world holds its own narration prompt, switched on. It keeps every chip of the built-in prompt and reads the four tone chips. The world system prompt is one line: "This world has no setting or story of its own. The entities present and the player set the scene."
- Voice rules changed: the role line, the second-person and third-person rule, the rule that the entities carry each reply, a rule that the entity descriptions set the scene, a rule for a room with no entity, names from the start, and the ending rule. "Be concise and vivid" gave its place to the Prose Style chip.
- Two stat rules are left out, because the world has no stats. The `<STATS DESCRIPTION>` chip stays.
- The location text gained one sentence: "With nobody present, it is a quiet, ordinary room." See the empty room below.
- The player preset adds a line to every narration user message ("The player's action is the turn's first beat…"). A world cannot change it, so the prompt keeps the same sentence in its Output section.

**Probe.** `testing/baseline/harness/open-chat-probe.mjs`, run with `vite-node`. It uses the app's own world migration, card importer, trait pins, world-prompt seam and `buildNarrationPrompt`. Arm A is the built-in prompt over this world, which is what a player gets after the opt-out. Arm B is the world prompt. Seeds are paired. The fixture is `testing/baseline/open-chat-cards.json`, two original V2 cards. Cases: `solo` (the greeting is page one, then three turns), `duo` (two entities), `cold` (no greeting, the world's Opening Action starts), `empty` (no entity). Tiers: the cloud default endpoint at 12 runs per arm, and Cydonia 24B (`cydonia-24b-v4.3@q4_k_m`) at 3 runs. `n` is replies per cell.

Dialogue share is quoted text, less the player's own line read back, as a share of the reply. Frame held means no first-person narration and no third-person player.

| Tier | Case | n | Dialogue A → B | Frame held A → B | Entity named A → B | Words A → B |
|---|---|---|---|---|---|---|
| Cloud | solo | 36 | 27.6% → 24.0% | 36/36 → 36/36 | 29/36 → 36/36 | 115 → 142 |
| Cloud | duo | 24 | 21.8% → 24.5% | 24/24 → 24/24 | 16/24 → 20/24 | 121 → 133 |
| Cloud | cold | 24 | 4.6% → 10.3% | 24/24 → 24/24 | 24/24 → 24/24 | 178 → 189 |
| Cydonia | solo | 9 | 35.3% → 40.6% | 9/9 → 9/9 | 9/9 → 9/9 | 133 → 117 |
| Cydonia | duo | 6 | 42.3% → 38.9% | 6/6 → 6/6 | 6/6 → 4/6 | 141 → 141 |
| Cydonia | cold | 6 | 17.9% → 29.0% | 6/6 → 6/6 | 6/6 → 6/6 | 142 → 135 |

Reading: the frame holds in every reply on both arms, so the built-in prompt was not breaking it. The world prompt raises dialogue on a cold start on both tiers. It does not raise dialogue after a greeting on the cloud tier; the greeting sets the register there. It names the entity more reliably on the cloud tier.

Reply length per Reply Length setting, `solo` case, words (paragraphs). Cloud n = 18 per cell (none: 36), Cydonia n = 9.

| Tier | Arm | Short | None (Medium) | Long |
|---|---|---|---|---|
| Cloud | A | 95 (1.9) | 115 (2.2) | 115 (2.3) |
| Cloud | B | 118 (2.2) | 142 (2.6) | 228 (3.8) |
| Cydonia | A | 113 (4.8) | 133 (4.4) | 131 (4.7) |
| Cydonia | B | 124 (4.9) | 117 (4.1) | 146 (5.8) |

Reading: arm A cannot read the setting, by design. Arm B follows it on the cloud tier. On Cydonia only Long separates; the greeting's short one-line paragraphs lock the register. The length chip was tried in three places (last guideline, last sentence of the prompt, one rule with `<LENGTH GUIDANCE>` named as the upper limit). The last guideline measured best and shipped. `<LENGTH GUIDANCE>` read "Write at most 6 short paragraphs" in these runs, from a local max-tokens default of 512.

Narration Share, arm B, `solo`: cloud Mostly Dialogue 26.4% against Descriptive 23.1% (n = 18); Cydonia 38.5% against 39.4% (n = 9). The setting moves dialogue share very little after a greeting on either tier. The tone sentences are ticket 02 content and are unchanged here.

Other metrics, every case with an entity, both tiers, both arms: narrator question to the player 0, reply that leaves the story 0, bold 0, raw chip or token 0, cut reply 0. Past-tense narration on cloud `cold`: 4/24 → 1/24.

**Open: the empty room (the guard the guide asks for).** With no entity present:

- Cydonia, first draft of arm B: in 2 of 3 chains the model left the story and asked the player to define characters. A rule for the empty room plus the new location sentence fixed that: 0 of 12 now. A title heading such as `# Here` still tops 8 of 12 empty-room replies on arm B (2 of 12 on arm A). It never appears with an entity present.
- Cloud, final wording: someone other than the player speaks in 16 of 24 replies on arm B, against 6 of 24 on arm A (dialogue share 5.8% against 1.8%). The model invents a companion. The world's Opening Action is "I look up and say hello", which invites one. Two rule wordings were tried; the second took the share from 10.0% to 5.8%. This guard does not hold at zero, so the regression criterion stays open for a product ruling: an invented companion may be acceptable in a chat world that the readme tells the player not to enter alone.

**Live check.** `e2e/open-chat.spec.ts` boots this world in the real game view with the card's entity picked (the `pickedOpening` dev fixture now takes `devPicked` entities from a served world file). With the mock model it asserts: the greeting is page one with no narration request, the next request's history is start message, greeting, action, and its system prompt is the world prompt with every tone default as text and no raw chip. Removing the `worldPromptChipValues` line in GameViewer turns it red, so it guards the wiring ticket 07 left untested. With `OPEN_CHAT_LIVE` and `OPEN_CHAT_MODEL` set it sent the turn to Cydonia: the reply kept Maren in third person, her speech in quotes, and the player as "you". Run it with `E2E_PORT` set to a free port when another checkout holds 5183.

**Not covered.** A tone trait switched on during a live playthrough. The unit test covers pins through the seam, and ticket 02 checked the switch live before the chips moved.

**Seen, not fixed.**

- The Notes panel warns that the system prompt has no `<NOTES>` chip. It searches for the bare token, and both the built-in prompt and this one place the chip with options.
- Three Re-generate tests in `e2e/opening-narration.spec.ts` fail on this checkout: no button named "Re-generate". They use the `writtenOpening` fixture, which this ticket did not touch.
- A picked tone trait shows under the "Traits" heading of the prompt as a bare name ("Reply Length: Short"), beside its instruction sentence.
- The rendered prompt holds runs of blank lines where headed chips are empty. The built-in prompt does the same.
