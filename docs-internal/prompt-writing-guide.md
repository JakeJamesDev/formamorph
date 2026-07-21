# Prompt Writing Guide (small local models)

How to write and edit the prompts in `src/components/game/GamePrompts.ts` (and any AI-call text). Formamorph runs on small local models (7B–31B reference tiers), which follow prompts very differently from frontier models. This guide is the durable reference; the CLAUDE.md prompt notes are the short anecdotal version of it.

Two tiers below: **Researched guidelines** (sourced, general to small models + roleplay) and **Anecdotal evidence** (our own project lore — real, but n-of-us, not literature).

---

## Researched guidelines

### 1. Specific, not long

Small models need *precise* instructions, not *more* of them. These pull in opposite directions and length loses:

- Bloated prompts measurably degrade output ("a bloated system prompt makes it less effective").
- **3–5 sharp constraints beat 20 vague ones.** Every extra rule spends the model's limited attention budget.
- Small context windows (often 8K) mean prose rules also cost tokens you need for world/history.

> Failure mode: compound, multi-clause sentences a 12B can't hold across a turn. If a rule needs two clauses and a carve-out, it's too big — cut it to one positive line.

### 2. Positive phrasing only

Token generation biases toward *selecting* the next token, not *avoiding* one, so "don't" instructions are weak-to-ignored.

- "Never re-pose a question" still fails — the model processes "re-pose a question" and keeps the concept active.
- State the **wanted action alone**, with no mention of the failure it replaces. Replace a bad rule; don't append a carve-out to it.
- A short negative can make a *minor correction* after the positive contract exists — but never as the primary instruction, and never stacked.

### 3. Format / role framing over examples

Few-shot examples are the single strongest lever for small models — but our rule forbids parrotable example values (models copy them verbatim). Resolution:

- Show the **shape** (role, template, output format), not fillable content.
- Frame the model's *job* as a role it plays, not an abstract instruction it evaluates. Small models follow "you are the X who does Y" better than "the output should be Y."

### 4. Placement: put the load-bearing rule last

Small models weight recency heavily. The instruction that most needs to land — the autonomy/advance rule, the format contract — goes at the **end** of the prompt or in post-format position, not buried mid-list.

### 5. Sampler is a co-variable, not separate

Looping, repetition, and stalling are frequently *sampler* problems, not prompt problems. Before crediting or blaming a wording change:

- Check repetition penalty (1.0 = **off**), temperature, top_p together — temperature alone doesn't fix flat/looping output.
- A probe testing a prompt edit against a loop bug should co-vary rep-pen so the wording isn't miscredited.

### 6. Roleplay-specific

- **Never say "roleplay" to the model.** It pulls output toward the low-quality online-RP training distribution. Frame as a simulation / game / continuity task instead.
- **Narrator / Game Master framing** lets the model detach from any single character and manage the whole scene — introducing, advancing, resolving.
- **The "goalmaster" pattern for agency:** give a role whose explicit job is to *arrange things so the plot moves* — anticipatory, offering openings, acting rather than asking the player's permission. A scene that stalls usually lacks a positive contract that a set-up beat must *pay off*; add that job, don't forbid the stall.

---

## Anecdotal evidence (Formamorph project lore)

Not from the literature — our own findings, working with the current test targets: the **cloud default endpoint** (what most players actually hit) and **Cydonia 24B** locally. Treat as strong priors, not proven.

- **Prompts are a first-class surface.** Prompt text changes are *behavior* changes, not copy edits.
- **Positive contracts, with the shape shown** — "do X, in this form" — not prohibition lists. (Same as researched #2/#3, independently observed here.)
- **No example values the model can parrot.** Small local models will lift a sample value straight into output.
- **Role/template framing beats abstract rules** on our tiers specifically.
- **Per-prompt sampler pins** live in `promptSamplers.ts`; each AI call decides temp/penalty explicitly (narration's values don't transfer). Current pins (stats 0.2 / location 0.15 / summary 0 / planning 0.4) were derived on the *old* model pair and aren't re-benchmarked on the current one.
- **Reasoning models can empty `content`** — some route output to a `reasoning` field and stall; probes/harness send `reasoning_effort: "none"`.
- **Message shape is a prompt surface too.** How the player's action enters the conversation changed dialogue more than any wording edit: bare first-person user turns ("I sit beside her.") roughly doubled NPC speech versus the app's `Player action: X` wrapper, because the model then has a conversant rather than a report. Conversely, rebuilding the story into one user message (no assistant turns) **backfired** — the model copied its own prior narration near-verbatim. Test format before assuming a failure is a wording problem.
- **Failure modes are model-specific.** The dialogue collapse that motivated all of this reproduces on the cloud Gemma build and **not at all** on Cydonia (which never went silent on the same script, but repeats phrasing far more). Always ask "whose failure is this?" before generalizing a fix.

---

## Measuring a prompt section (ablation method)

Adherence ≠ influence. A rule the output rarely satisfies may still be the only thing holding the behavior up. **Delete the section and re-run** — that is the only way to weigh it.

> Worked example: the narration dialogue rule looked ignored (quotes in 19% of turns). Ablated, dialogue went to **0 in 60 turns**. It was the single highest-leverage line in the prompt.

What ablations have shown so far (cloud default endpoint):

| Finding | Detail |
|---|---|
| **Length guidance is a target, not a cap** | Removing "at most N short paragraphs" made output *shorter* (4 paras → 2). Models write **up to** the stated number. Adding framing mass anywhere tends to lengthen turns. |
| **Author world-text is the strongest content lever** | A motif present in ~25% of turns dropped to **0** when the world section was removed. Author text is treated as content, not rules. |
| **End position is for format contracts, not behavior** | The closing output contract reliably kills menus/questions. Appending a *behavioral* rule to the same slot did nothing measurable. |
| **Don't stack levers on one channel** | Role framing + rule rewrite + message format all targeting dialogue: each helped alone, but stacked they damped or destabilized the result. Past a point, more framing buys variance, not compliance (the attention-budget rule, observed). |

### Session-level probing (multi-turn chains)

Single-call probes miss the failure that only appears over a session:

- **Register lock** — a chain commits to a register (talkative/silent, present/past tense) within the first few turns and self-reinforces for the rest. Between-chain variance regularly exceeds a section's effect, and it is the dominant force in long sessions.
- **Every batch carries its own control.** The cloud default endpoint mood-drifts between batches by up to ±3× — the same cell scored 59% / 48% / 11% / 24% across four batches. Cross-batch comparison is invalid; in-batch comparison is fine.
- **n ≥ 4 runs per cell**, and settle close calls with **one large paired batch (8+ per cell)**, not more small ones. Small batches on a bimodal metric coin-flip.
- **Read metrics in context.** Our freeze/intensity regex counts charged body language ("breath catches", "grip tightens") — it *rises* alongside healthy dialogue when characters act physically. It signals a stall only when it moves against dialogue.
- **False-positive guard, always.** Any "make X happen more" edit needs scenes where X must **not** happen (for dialogue: empty rooms, mute companions). Ship only when the guard stays at zero.

Tooling: `format-arms-probe.mjs` (session replay, `--arms` / `--ablate` / `--edit`) and `overfire-probe.mjs` (the guard).

## The done-bar for a prompt change

A prompt edit is not "done" on one good-looking output. Required evidence:

- [ ] A/B probe on **both current test targets** — the cloud default endpoint and Cydonia 24B — **≥2 runs per case**.
- [ ] Metrics quoted **before vs after**; regressions on the *other* metrics checked (fixing one thing must not break another).
- [ ] The specific pathology reproduced in the probe corpus, not just generic turns.
- [ ] Contract phrased positively, no parrotable values.

Tooling: the `probe` skill and `testing/baseline/harness/*-probe.mjs`. One pretty completion is noise.

---

*Sources: [web.dev — prompting smaller LLMs](https://web.dev/articles/practical-prompt-engineering) · [Sukino SillyTavern presets](https://huggingface.co/Sukino/SillyTavern-Settings-and-Presets) · [Gadlet — positive vs negative prompts](https://gadlet.com/posts/negative-prompting/) · [ianbicking — LLM roleplay observations](https://ianbicking.org/blog/2024/04/roleplaying-by-llm) · [Talk Less, Call Right (arXiv 2509.00482)](https://arxiv.org/html/2509.00482v1)*
