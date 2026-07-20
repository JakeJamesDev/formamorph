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

Not from the literature — our own findings, working with the reference tiers (Silver-Siren 12B avg, MeroMero 31B premium). Treat as strong priors, not proven.

- **Prompts are a first-class surface.** Prompt text changes are *behavior* changes, not copy edits.
- **Positive contracts, with the shape shown** — "do X, in this form" — not prohibition lists. (Same as researched #2/#3, independently observed here.)
- **No example values the model can parrot.** Small local models will lift a sample value straight into output.
- **Role/template framing beats abstract rules** on our tiers specifically.
- **Per-prompt sampler pins** live in `promptSamplers.ts`; each AI call decides temp/penalty explicitly (narration's values don't transfer). Current pins (stats 0.2 / location 0.15 / summary 0 / planning 0.4) were derived on the *old* model pair and aren't re-benchmarked on the current one.
- **Reasoning models can empty `content`** — some route output to a `reasoning` field and stall; probes/harness send `reasoning_effort: "none"`.

## The done-bar for a prompt change

A prompt edit is not "done" on one good-looking output. Required evidence:

- [ ] A/B probe on **both** reference tiers (12B + 31B), **≥2 runs per case**.
- [ ] Metrics quoted **before vs after**; regressions on the *other* metrics checked (fixing one thing must not break another).
- [ ] The specific pathology reproduced in the probe corpus, not just generic turns.
- [ ] Contract phrased positively, no parrotable values.

Tooling: the `probe` skill and `testing/baseline/harness/*-probe.mjs`. One pretty completion is noise.

---

*Sources: [web.dev — prompting smaller LLMs](https://web.dev/articles/practical-prompt-engineering) · [Sukino SillyTavern presets](https://huggingface.co/Sukino/SillyTavern-Settings-and-Presets) · [Gadlet — positive vs negative prompts](https://gadlet.com/posts/negative-prompting/) · [ianbicking — LLM roleplay observations](https://ianbicking.org/blog/2024/04/roleplaying-by-llm) · [Talk Less, Call Right (arXiv 2509.00482)](https://arxiv.org/html/2509.00482v1)*
