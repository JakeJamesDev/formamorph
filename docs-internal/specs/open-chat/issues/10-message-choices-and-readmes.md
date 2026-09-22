# 10: Message Choices and Readmes

Status: ready-for-human
Status note: built and probed; the Cydonia lead-in line under Open is the user's to weigh
Base: 535e7b50
Blocked by: 09
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A choice in Open Chat is the message the player could send back. It is the message text itself, with no quotation marks and no "I say" lead. A deed, when the player would do rather than say, sits between asterisks. Choices stay short and distinct, and the existing parser still reads them.

Rewrite the choices override from the revision 1 text. Then update both readmes for revision 2: the intro readme recommends one entity (more than one is not yet supported well) and explains the three tone groups; the gameplay readme keeps the Chat layout setting, mid-game tone switching, the bracket channel, and the choices switch. Copy follows the player-facing voice and the terminology rules. Run the copy sweep. Update the Changelog In-Progress entry if its wording no longer fits.

Read the prompt-writing guide before editing. Follow it: positive contract, generic examples only, no parrotable values.

## Acceptance criteria

- [x] A/B probe with the revision 1 choices prompt as the baseline arm, on both reference tiers, at least 2 runs per case, one imported card as the fixture
- [x] Metrics with numbers per arm under Comments: parse success, count in 3 to 5, lines with no quotation marks, lines with no "I say" or "I ask" lead, words per choice
- [x] The regression check from the guide passes on distinctness and the no-entity guard case
- [x] The intro readme recommends one entity and names three tone groups; the content test's label checks match
- [x] The gameplay readme holds no setup guidance, and every setting it names matches its live label
- [x] The copy sweep reports no findings
- [x] One full turn in the Chat layout shows a message reply and message choices, checked live
- [x] Four gates green

## Comments

**2026-09-21, what shipped.**

- The choices override is a message prompt. The role frame is the player choice writer "for a chat held by message"; the rules name two shapes: a typed option is the message itself, the exact words sent as plain text with no quotation marks around them and nothing before them, and a deed option sits between asterisks in the shape `*what I do*`. The rest is revision 1: sending a message is the action in a chat, the first and most options are typed when someone is present, every option is a deed when alone, one typed option answers a question, 3 to 10 words, the list is the whole reply. The entity chip headers read "Who I am chatting with"; every chip of the built-in prompt stays, so `parseChoices` reads the reply unchanged.
- The intro readme asks for one entity ("a chat with two or more is still an experiment"), says a stranger answers in an empty room, and explains the three groups with their picker descriptions. The gameplay readme says the action is the message, shows the asterisk deed shape in a code span so the asterisks survive markdown, and keeps the **Chat** layout, the **Traits** tab, the bracket channel with a message-shaped example, and the **Choices** switch. Every label matches its live copy, and the content test pins the one-entity recommendation. The copy sweep reads `.ts`, `.tsx` and `.md` only, so both readmes were dumped to a scratch `.md` inside the repo for the run: 0 notices. The Changelog line is unflagged on the branch sweep.
- The Changelog player entry reads "Each choice is a message you could send back, typed bare, or a deed between asterisks." The tooling entry describes the probe's revision 2 arms and metrics.
- Authored by a script that writes the three texts into the world file.

**Probe.** `testing/baseline/harness/open-chat-choices-probe.mjs`, rewritten for revision 2. Arm A is the revision 1 prompt read from `535e7b50` (`--a-world-rev`, the default; `--a-builtin` gives the preset instead). Arm B is the world file. The five entity cases are now first-person messages from the card in the revision 2 shape, with the greeting kept in the card's own shape; `empty` is unchanged, nobody there. Per line it reads: a quotation mark anywhere, an "I say"/"I ask" lead, a deed typed bare (`I` and a doing verb, addressed to nobody), a deed between asterisks, an unbalanced asterisk, a lead-in or heading line, the entity as speaker, and "I notices". Tiers: the cloud default endpoint at 8 runs per case, Cydonia 24B (`cydonia-24b-v4.3@q4_k_m`) at 3. "With an entity" is the five cases that have one: cloud 40 runs per arm, Cydonia 15. The `--rescore` flag still re-scores a stored run.

| Metric, with an entity | Cloud A → B | Cydonia A → B |
|---|---|---|
| Parse success (3 or more lines, no junk line) | 40/40 → 40/40 | 15/15 → 14/15 |
| Count in 3 to 5 | 40/40 → 40/40 | 14/15 → 13/15 |
| Lines with no quotation marks | 63% → 98% | 44% → 98% |
| Lines with no "I say" or "I ask" lead | 100% → 98% | 97% → 100% |
| Deeds typed bare (`I take the box`) | 60% → 15% | 38% → 9% |
| Deeds between asterisks | 0% → 25% | 2% → 43% |
| Runs with a typed message, cases that invite one | 32/32 → 32/32 | 12/12 → 12/12 |
| Words per choice | 7.1 → 7.1 | 7.9 → 9.1 |
| Choices over 10 words | 4% → 6% | 15% → 32% |
| Longest choice, words | 13 → 14 | 18 → 21 |
| Cut at the 256-token cap | 0/48 → 0/48 | 0/18 → 0/18 |

Difference B − A with a 95% interval from a bootstrap that resamples whole runs (4000 draws); bold intervals leave out zero:

| Tier | Quotation marks, points | Bare deeds, points | Asterisk deeds, points | Words |
|---|---|---|---|---|
| Cloud | **−34 [−43, −26]** | **−46 [−56, −35]** | **+25 [+19, +32]** | 0.0 [−0.6, +0.6] |
| Cydonia | **−54 [−67, −42]** | **−29 [−44, −8]** | **+41 [+23, +60]** | +1.2 [−0.5, +2.9] |

**Regression check.**

- Guard case `empty`: quotation marks 0 on both arms and tiers. Arm A writes every option as a bare `I` deed; arm B puts them between asterisks (cloud 80% of lines, 6/8 runs with none bare; Cydonia 100%). No option speaks to nobody on either arm.
- Distinct choices: mean word overlap between two choices of one run is 0.01 on both arms and tiers.
- "I notices": 0 on the cloud in arm A, 1 line in arm B (48 runs); 0 on Cydonia.
- "I say" leads on the cloud: 0 lines in arm A, 3 in arm B (about 130 lines), all `I say, "..."` with the words in quotation marks. Cydonia went 2 → 0.
- Unbalanced asterisks: 0 lines on both tiers.
- `task`: the entity hands the player a job, and most options stay deeds (cloud 50% asterisk deeds, Cydonia 92%). That is the correct reading of the scene.

**Wording search.** Eight drafts on the cloud tier at 4 runs per case, each in one batch with arm A, then the survivors on Cydonia at 3. The two-shape rule in the middle of the list (the shipped text) measured best on both tiers. Naming both shapes in one rule and again as the last line raised quotation marks (6% → 24%). A "what I would type" frame lost the message sense and wrote bare deeds (55%). A deed rule as the last line with "always wrapped in asterisks: *I do it*" took the cloud empty room to 100% asterisk deeds but made Cydonia write deeds instead of messages (69% deeds, 7/12 inviting runs with any message), and the same wording in the middle position measured level with the shipped text. A "You are the player" role frame measured level. Run files are under `testing/baseline/runs/open-chat-choices-probe-*`.

**Live check.** `e2e/open-chat.spec.ts` keeps the choices request on under `OPEN_CHAT_LIVE` and prints the choice buttons. On Cydonia the greeting was page one, the next turn came back as Maren in first person, and the choices were `What? That can't be right.`, `*I lean forward, trying to read the note.*`, `May I see it?`, `*I hold out my hand expectantly.*`, `Why would she have a letter for me?`. The same run showed the open item below: a first button `Here are your options:`. With the mock model the three specs pass on desktop.

**Open.**

- **Cydonia writes a lead-in line in about 1 run in 8, and the parser keeps it as a button.** Revision 1 had none (36/36 in ticket 04, 15/15 here). On 30 more arm B runs with an entity at paired seeds, 4 runs had one (`I'll help you write your next message. Based on the scene...`, `Here are some distinct ways you could answer...`). Two rewordings measured worse at the same seeds: "replies" for "messages" in the role line (5 junk lines against 2), and a positive first-line rule in place of "no lead-in sentence" (10 against 2). The cloud tier shows none in 48 runs. The parser strips list markers only, by design; a lead-in filter there is an app change and the user's call.
- Cydonia's choices run longer than revision 1 (words +1.2, over 10 words 15% → 32%), as an asterisk deed carries more words than a bare one. Length guidance is a target on Cydonia, as ticket 04 recorded.
- The cloud model still types about 1 deed in 7 bare (`I take the letter opener`). Every wording that moved it either raised quotation marks on the cloud or over-fired deeds on Cydonia.
- The cloud endpoint spilled a reasoning dump (`Thinking Process:`) into 3 of about 100 arm B draft runs and 0 arm A runs, cut at the cap; 0 in the final 48. Seen, not explained.
- A deed choice reaches the button with its asterisks as typed, as ticket 04 noted for emphasis.

**Seen, not fixed.** `SettingsModal.quoteColor.test.tsx` ("edits the active mode only") failed on a `waitFor` timeout in 2 of 4 full-suite runs this session and passes alone (3/3, 7.9s); not this ticket's file. The two Open Chat probes still copy their context assembly and arm setup; a shared helper is the open note from ticket 04.
