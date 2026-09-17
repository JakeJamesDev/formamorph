# Model Research — findings & methodology

> **Why this doc exists:** so every "what models should we recommend/test?" request starts from the same
> baseline instead of re-deriving (and getting different answers each time). When asked for model info,
> **read this first, refresh only what's stale, then update this doc** with the new numbers + date.

**Last updated:** 2026-09-17 (September candidate sweep; MeroMero v2 screened B/65 vs v1 re-screened A/72 — see *September 2026 refresh*)

---

## Maintenance protocol

1. Read this doc. Most of the answer is already here.
2. Refresh only what the request needs. Re-pull live numbers (downloads, dates, new releases) — don't trust
   the table below for *current* counts, trust it for *which models* and *why*.
3. Update the relevant section + the **Last updated** date + the "as of" date on any data table.
4. Keep it human-scannable: short sections, tables, no walls of prose.

---

## Authoritative sources (in priority order)

| Source | Use for | How to pull |
|---|---|---|
| **UGI Leaderboard** CSV | Writing score, willingness (W/10), `Is Thinking Model`, params — ranked | `hf_fs cat hf://spaces/DontPlanToEnd/UGI-Leaderboard/ugi-leaderboard-data.csv` (652KB; parse cols `Writing ✍️`, `#P`, `Is Thinking Model`, `W/10 👍`) |
| **HF API** (per repo) | Live all-time downloads + release date (`createdAt`) | `GET https://huggingface.co/api/models/{repo}?expand[]=downloadsAllTime&expand[]=createdAt` |
| **HF Hub search** | Finding finetunes / GGUF repos / quant files + sizes | `hub_repo_search` (sort `downloads`); `hf_fs ls hf://models/{repo} --glob "*Q4_K_M*.gguf"` for exact file + bytes |
| **r/SillyTavern** weekly Megathread | Community consensus ("what are people running") | Reddit blocks WebFetch — **paste the thread**, don't scrape. Search `r/SillyTavernAI` for the pinned Megathread |
| **EQ-Bench Creative Writing** | Prose quality incl. reasoning models | eqbench.com (Gradio; read the page, don't scrape) |

**Search gotcha:** `hub_repo_search` fails on long multi-word queries — use 1–3 distinctive terms (a model name,
an author), sort by `downloads`.

---

## Model profile — what qualifies a model for Formamorph

> Derived from the app's actual shape: one heavy creative call + ~10 tiny structured calls per turn, all
> served by the **same** local model. Every output is parsed as **lenient line-based plain text** — no JSON,
> no function/tool calling anywhere (`parseDirectorCast` reads `- Name - placement`; stats are regex'd off
> `name: +N` lines). So structured-output reliability is *not* an axis; format discipline + restraint are.

**The per-turn workload (one model plays every role):**

| Role | Output shape | What it demands |
|---|---|---|
| **narration** | vivid 2nd-person present-tense prose | the visible product — prose quality, restraint, voice discipline |
| choices | 3–5 lines, each "I <verb>…" | format obedience, no lead-in |
| statUpdates | `name: +N` lines, **often empty** | restraint — emit nothing when nothing moved |
| locationChange | one name **or** `NONE` | classification + restraint |
| summary / diary / discoverEntity | 1–2 sentences, or `nothing notable` | faithful compression, no invention |
| director / character / storyboard | `Scene:` / `Cast:` bullets / beats | structured continuity planning |

**Selection axes, in priority order:**

1. **Refusal rate → hard gate.** Below a willingness threshold (UGI `W/10`), disqualified. Adult RP; no prose
   skill buys back a model that hedges or moralizes. (Why the defaults are abliterated/heretic.)
2. **2nd-person prose quality, scored thinking-OFF.** Narration is the product; weight EQ-Bench / UGI Writing
   without reasoning, since reasoning over-schematizes prose.
3. **Format discipline & restraint on plain-text contracts.** Holds voice/tense/name-discipline and — the real
   discriminator — knows when to emit `NONE` / empty / `nothing notable`. Small models fail this before they
   fail prose. Only measurable by **probe**, not by any leaderboard.
4. **Fits a VRAM tier as GGUF** (≤4 / ≤8 / ≤16 / No-Limit); MoE welcome — low active params buy
   quality-per-VRAM and cut the ~10-calls/turn latency.
5. **Long-context coherence** across the fat injected prompt (world + lore + stats + traits + locations +
   entities + history + digests), not just window size.

**Explicitly NOT axes** (stated so they stop getting weighed):

- JSON-mode / function-calling / structured-output reliability — parsing is lenient line-based; irrelevant.
- Native reasoning as a headline feature — **per-prompt split**: off for narration, on for
  director/character/storyboard. A reasoning model is judged on its thinking-off prose first, planning second.
- Raw knowledge / MMLU-style intelligence — steerability beats smarts here.

**Policy tension — RESOLVED 2026-07-17.** The old catalog rule was "RP-finetunes only," while the shipped
**cloud default is a *general* decensored writer (gemma-4 heretic)** — excluded by a policy it contradicted.
The A/B settled it: the RP-tune premium did **not** survive. Eligibility is now per-model on measured quality,
general decensored included. See the gate-probe results below.

---

## Key findings (stable — the "why")

- **Reasoning helps planning, hurts free prose.** EQ-Bench: reasoning models over-schematize prose. So test
  **narration with thinking OFF**, **staging/character (structured) prompts with thinking ON**. Local engine
  is fully wired for reasoning (per-prompt `thinking_budget_tokens` → `budgets.thoughtTokens`, `<think>`
  reconstruction so choices/stats aren't swallowed).
- **MoE punches above its VRAM class.** Gemma-4 26B-A4B (4B active) / Qwen3.6-35B-A3B run on modest cards via
  offload — the community's current default reasoning models.
- **The 8B RP scene is frozen at 2024.** Community moved to 12B (Nemo) and 24B (Mistral-Small); nothing new at
  8B beats Stheno v3.4 / Lunaris. Reasoning RP finetunes barely exist below ~35B.
- **Policy: judge per-model, not by the RP-finetune label** (decided 2026-07-17, superseding the old
  "RP-finetunes only" rule). General decensored models (e.g. gemma-4 heretic) **are eligible** — the gate
  probe below found no willingness or prose advantage from RP-tuning on a matched base; tier and per-model
  quality dominated. Screen a candidate before adding it (`npm run screen -- --model <label>`). The catalog
  was **not** changed on the flip: every current entry is still an RP finetune, which is now history rather
  than a requirement. A reasoning badge still needs a reasoning base (Qwen3 / Qwen3.6-A3B).
- **Two reference test tiers** for probes (harness): Silver-Siren-ST-12B (average) + G4-MeroMero-31B (premium),
  cross-family. Modelfiles in `testing/baseline/harness/`.

---

## Per-model behavior findings — dialogue-collapse investigation (2026-07-22)

> Full evidence trail lives in the `dialogue-collapse-investigation` memory + `milestone-memory-design.md`;
> this is the model-facing summary. Metric: the strict dialogue-hold gate (NPC speaks ≥2 engaging quoted
> sentences, 25–50 consecutive baited turns, decay = fail).

**Cloud default endpoint (gemma4-e4b class):**

| Finding | Numbers |
|---|---|
| Dialogue decay is **model-level, time-based** | Every history shape decays; charge is an additive tax, not the cause (cool asks decay too) |
| **Condensed history is its lifeline** | Milestone memory ≈ bare history at ~¼ flat context (7–8k chars vs 30k growing) |
| **The recency slot is its big lever** | Voice clause on the current user turn: ~3× participation (23→82, 40→71/100), first-ever full 50-turn hold; shipped |
| Verbatim floor sweet spot = **4** | 2 < 3 < 4 ≥ 5 (floor turns are its only dialogue exemplars; more is just register mass) |
| Cannot follow name-withholding | Leaks names with or without the rule — the plan-mode code sanitizer is the real guard |

**Cydonia 24B v4.3 (strong local, the class representative):**

| Finding | Numbers |
|---|---|
| **Perfect dialogue on verbatim history** — at any tested length | 50-turn: 97–100% participation, 31k context no strain |
| **Condensed history REGRESSES it** long-session | Milestone memory: all runs silent by ~turn 42 (last8 0% vs bare 100%) — digests only cost it exemplars |
| Permission-stance fixes must be **subtractive** | Authority clauses (4 wordings) made re-asks up to 5× worse; deleting the prompt's ask-license worked |
| Follows name-withholding beautifully | Converts label-leaks into earned diegetic introductions |

**Cross-model (both tiers):**

- **The current-turn user slot is clause-specific, not a migration lane.** Voice clause thrives there; the
  ending contract (first8 59→19%) and length guidance (words +58%) both measured worse. Evidence per candidate.
- **Measurement gotchas:** cloud mood-drifts ±2–3× BETWEEN batches (in-batch pairing only, always); LM Studio
  replay probes pin `--seed` — same-seed reruns are byte-identical, NOT replication (vary the seed).

---

## Current catalog + screen scores — data as of 2026-07-17

Source of truth is [`src/lib/localModels.ts`](../src/lib/localModels.ts) (12 models); this mirrors it with
screen scores. Live board: [`../testing/baseline/leaderboard.md`](../testing/baseline/leaderboard.md). Tiers by
VRAM ceiling. 🧠 = reasoning badge. **Obj** = gate-probe objective (restraint 35 / stat-dir 30 / format 35);
tier B≥50, A≥70. **▶ = recommended pick** for that VRAM tier.

| Tier | Model | Obj | Seeds | Size | Notes |
|---|---|---|---|---|---|
| ≤4GB | ▶ Impish LLAMA 4B | C/31 | 3 | 2.8GB | only tier member; weak (format 30%). Tier is a hole. |
| ≤8GB | ▶ Gemma-4 12B Uncensored (HauhauCS) | **B/65** | 3 | 7.4GB | **added 2026-07-17**; new tier winner. License 'gemma' (uploader-declared; binds the downloader, not us) |
| ≤8GB | Anubis Mini 8B | B/60 | 3 | 4.9GB | prior tier best |
| ≤8GB | Stheno v3.4 8B | B/51 | 3 | 4.9GB | high variance (36–62) |
| ≤8GB | Lunaris v1 8B | C/49 | 3 | 4.9GB | |
| ≤8GB | Wingless Imp 8B | C/29 | 2 | 4.9GB | weakest tier8 |
| ≤16GB | ▶ Cydonia 24B v4.3 | **B/60** | 3 | 14.3GB | score is the **shipping Q4_K_M**; Q6 proxy read B/65 (quant costs ~5, not the tier). Tier winner. |
| ≤16GB | Rocinante-X 12B | C/37 | 3 | 7.5GB | |
| ≤16GB | Painted Fantasy 24B v4.1 | — | 0 | 14.3GB | untested; Magistral base, same as Skyfall |
| ≤16GB | Impish Bloodmoon 12B | — | 0 | 7.5GB | untested; Mistral-Nemo base (has never cleared B) |
| No-Limit | ▶ G4 MeroMero 31B | **A/84** | 3 | 18.7GB | **added 2026-07-17**; top of the board, only model with real restraint (56%) |
| No-Limit | Gemma-4 26B StyleTune V2 | B/69 | 3 | 17.2GB | **added 2026-07-17**; #2 overall, 2nd model to show restraint (11%) |
| No-Limit | 🧠 Qwen3.6 35B-A3B Anko | B/65 | 3 | 21.4GB | reasoning flag verified correct |
| No-Limit | Skyfall 31B v4.2 | B/51 | 2 | 19.0GB | Magistral (reasoning) base, **not** flagged 🧠 — behaves fine, no `[THINK]` leak |
| No-Limit | Euryale 70B v2.3 | — | 0 | 42.5GB | untested; won't fit a 24GB card at Q4 |

Download counts refresh live at runtime (`src/lib/useCatalogDownloads.ts`); the bundled snapshot is in
localModels.ts.

**Gemma-4 added (2026-07-17).** Screened both A/77 reference-tier candidates properly (3 seeds, engine,
hardened turns) to pick one: **G4 MeroMero 31B (RP) A/84 vs gemma31b-heretic (general) B/65** — MeroMero wins
on restraint (56% vs 0%), the only model on the board that keeps stats quiet on idle turns. This **reverses**
the old gate-probe "general ≥ RP" call, which was 1-seed/Ollama/soft-turns. MeroMero is now the No-Limit pick
and top of the board. Gemma-4 is Apache-2.0 (verified live — ungated, no field-of-use restriction). The
gemma-heretic variant stays a reference tier, not added.

### Notable rejects (don't re-propose without reason)
- **Qwen3-4B RPG Roleplay v2**, **Gemmasutra Small 4B**, **Gemmasutra Mini 2B** — removed from the catalog
  2026-07-17. All three fail location routing (60/77/67%). Qwen3-4B additionally ships a broken embedded chat
  template (Unsloth GRPO training template, not Qwen3's) that intermittently returns an empty narration and
  stalls the turn. Removing them left tier4 on a single model (see the hole above).
- **gemma-4 heretic** family (E4B/12B/26B-A4B) — **not a reject**: policy flipped 2026-07-17, general
  decensored models are eligible. `gemma31b-heretic` scored A/77. Needs a screen before adding.
- **Qwen3.5-2B abliterated** — screened 2026-07-17, REJECT (routing 80%): teleports on START GAME, misses the
  real move. Template is clean (proper QwenChatWrapper, reasoning model) — it's a capability limit, not a bug.
- **Magnum v4 72B** — dropped; Qwen2.5-era, superseded.
- **Mistral-Nemo abliterated** (natong19 / Triangle104 GGUFs) — won't load: broken tool-call chat template
  (`selectattr('tool_calls', 'undefined')`) on both Ollama and llama.cpp. Use `Heretic-v2` instead.

---

## Gate probe results — RP-tune vs general decensored (2026-07-15)

Controlled A/B: same base, RP finetune vs general decensored, across 3 pairs × 2 prompt arms (shipped vs
neutral control) × 3 seeds, on the mature-tone `blackrue-waystation` gate world. Full method + scoring in
[`../testing/baseline/GATE-PROBE.md`](../testing/baseline/GATE-PROBE.md).

| Pair (same base) | RP-tuned | General decensored | Result |
|---|---|---|---|
| Gemma-4 31B | meromero-31b | gemma31b-heretic | **general ≥ RP** (best stat-direction; prose/willingness tied) |
| Gemma-4 26B-A4B | meromero-26b | gemma26b-heretic | **tie** (both over-fire on no-op restraint) |
| Mistral-Nemo 12B | silver-siren | mistral-heretic | **RP ≥ general** (cleaner prose + choices format) |

**Findings (n=3–4/cell):**
- **Willingness is uniform** — ~0 refusal markers in any model, RP or general. At judgeable content, heretic/
  abliterated general models engage with violence, cruelty, and intimacy exactly as RP tunes do. The
  refusal-gate rationale for excluding general models is **not supported**.
- **RP-tuning washes out** — an advantage in Gemma, a slight *dis*advantage in Nemo. The real drivers are
  **tier/base** (premium Gemma-31B beats all on restraint + stat direction) and per-model quality, not the
  RP-tune label.
- **Location routing is solved** — 0 errors, all models, both arms.
- **Restraint (no-op over-fire) is the discriminator** — only premium Gemma-31B under the neutral prompt
  restrains cleanly (meromero-31b 2/12, gemma31b-heretic 4/12); silver-siren + both 26B fire on nearly every
  no-op. Weakest overall = silver-siren (wrong-direction Vigor, chronic Nerve-spam, messiest choices).
- **Prompt-arm effect** — the neutral control *improved* restraint on the strong models; the shipped prompt's
  main value is avoiding the "(no stats moved)" prose verbalization that the real parser would choke on.

**Policy outcome (decided 2026-07-17):** flipped from *"RP-finetunes only"* to *"evaluate per-model by tier +
measured quality; general decensored models are eligible."* The **catalog was deliberately left unchanged** —
the flip grants eligibility, it does not add models. Candidates go through `npm run screen` first. This also
vindicates the gemma-heretic cloud default. Note the probed models (MeroMero / gemma-heretic / Silver-Siren)
are the *reference test tiers*, not catalog entries.

## Full-catalog screen (2026-07-17)

The entire 15-model catalog has now been through the gate (scores in the catalog table above). Getting there
required three harness fixes — all landed, all in `run.mjs` / `screenScore.mjs` / `electron/llmEngine.cjs`:

- **Engine driven as the desktop build** — the harness fakes `window.formamorphDesktop` and puts the app on
  the bundled engine, so an engine model takes the real `localModelActive` path and gets
  `thinking_budget_tokens` (not the coarse `reasoning_effort` the engine ignores). Without this a reasoning
  model spends the whole narration inside `<think>` and stalls — Anko was unscreenable until this landed.
  <br>**Mechanism changed 2026-08-07:** engine mode was a `useCustomEndpoint` flag; the engine is now an
  endpoint preset, so "engine mode" means selecting `builtin-engine`. The harness still seeds the old flag
  and currently works only because the one-time `migrateEngineToPreset` converts it — see the note under
  *Harness debt* below.
- **`fitContext` on model load** — `llmEngine.start()` now loads with `gpuLayers:{fitContext:{contextSize}}`,
  so auto layer-fit reserves KV room. Prior behavior over-offloaded and failed to load 19GB-class models on a
  24GB card — and got *worse* the more VRAM was free.
- **Scorer strips reasoning** — `screenScore.pickResponse` strips `<think>` like the app does. Without it a
  suppressed-thinking reasoning model's empty `<think></think>` failed the choices-format check (Anko C/30 →
  B/65 once fixed). Harness KV default dropped 16k → 8k (screens peak ~5.4k); big models fit at 8k.

**Restraint is real, not miscalibrated.** Earlier notes called it broken; it is not. The gate's no-op turns
(1/3/7) were hardened to genuinely idle actions (brush dust, retie a bootlace) — every catalog model *still*
fires stats on them (Cydonia charges Vigor for retying a lace), against the stat prompt's explicit "output
nothing when nothing changed." Only the two Gemma-4 reference models restrain (33 vs 0). It's a real top-end
differentiator; its 35% weight uniformly compresses the 8–24B pack (all 0) but correctly rewards Gemma-4.
Hardening the turns is score-neutral for models already at restraint 0 (confirmed: Cydonia scores identically
under both), so big-model rows sourced from pre-hardening fixed-harness runs remain valid.

**Caveats:** n=3–4, single world, content bounded at what the Claude judge can grade (hardest refusals
unprobed). The Mistral general control is `Heretic-v2` (the natong19 abliterated GGUFs won't load in current
llama.cpp — broken tool template).

### Non-catalog screens (2026-07-18) — reference tiers, candidates, cloud default

3-seed engine screens, hardened turns. None added to the catalog; recorded for comparison.

| Model | Obj | Restraint | Note |
|---|---|---|---|
| Silver-Siren-ST-12B (avg reference) | B/53 | 0 | refreshed from a stale B/50 (1-seed Ollama); high variance 43–65 |
| G4-MeroMero-26B-A4B | B/60 | 0 | MoE sibling of the A/84 31B — does **not** inherit its restraint; the magic is dense-31B-specific |
| gemma-4-E4B-heretic (cloud default) | **B/59** cloud / **B/65** local | 0 | `cooperdk/…-GPTQ-4bit` served via Aphrodite (custom-endpoint path) vs the Abiray GGUF on the engine path; local scores a touch higher/tighter — likelier the sampling path than the quant |

The **restraint gradient** now reads: MeroMero-31B 56 ≫ StyleTune-26B 11 ≫ everything else 0 (incl. the 26B MeroMero MoE and the cloud default). Restraint is what separates the top two from the B/65 pack.

## September 2026 refresh — new candidates and the MeroMero v2 screen

### Candidate sweep (2026-09-16, live Hub + UGI CSV)

Everything below is new since the July inventory or an iteration of a model we carry. UGI "none" = not on the
board yet. Sizes are Q4_K_M; prefer bartowski or mradermacher `-i1-` repos (imatrix) — author-uploaded GGUFs
are usually static.

| Model | Author | Base | Released | Q4_K_M | UGI Writing (W/10) | Relation to inventory |
|---|---|---|---|---|---|---|
| G4-MeroMero-v2-31B | zerofata | Gemma-4 31B | 2026-07-31 | 18.7 GB | none | **Iteration of the No-Limit pick.** Screened below. |
| Artemis-31B-v1.1 | TheDrummer | Gemma-4 31B | 2026-08-05 | 19.6 GB | none | Same author as Cydonia/Rocinante/Skyfall/Anubis; first Drummer dense Gemma-4 |
| Orion-26B-A4B-v1.1 | TheDrummer | Gemma-4 26B-A4B | 2026-09-13 | 18.0 GB | none | MoE sibling of Artemis |
| Glistening-Gem-31B-v2.1 | sophosympatheia | merge: Artemis + MeroMero v2 + Ortenzya | 2026-08-16 | 19.6 GB | none | Contains our MeroMero lineage; card admits rare fused-word artifacts |
| Goetia-26B-A4B v1.3 (v1.6 out) | Naphula | merge of ~15 Gemma-4 26B tunes | 2026-06-19 | 17.2 GB | **47.9** think / 40.9 (9.5 / 8.2) | Top Writing score under 35B on the board |
| Pantheon-Reasoning-26B-A4B-1.1-V2 | Gryphe | our StyleTune V2 | 2026-09-08 | 18.75 GB | none | Direct iteration on the catalog entry, adds trained reasoning |
| Gemma-4-12B-StyleTune | Gryphe | Gemma-4 12B | 2026-06-19 | 7.9 GB | none | lm_head-only tune, 56% fewer clichés; ≤8 GB candidate |
| Gemma4-12B-QAT-Uncensored Balanced | HauhauCS | Gemma-4 12B QAT | 2026-06-22 | 7.4 GB | none | Iteration of the ≤8 GB pick (QAT base, Balanced abliteration) |
| Qwen3.8-27B | Qwen | new base | 2026-08-05 | 16.5 GB | none | Dominant new base; Gated DeltaNet hybrid, engine support untested |
| Qwen3.8-27B Uncensored (HauhauCS) | HauhauCS | Qwen3.8-27B | 2026-08-17 | 17.9 GB (`Q4_K_P`) | none | 2.4M downloads; custom quant names |
| Qwen3.8-27B-Dominatrix | allura-org | Qwen3.8-27B | 2026-08-17 | 16.8 GB | none | Same org as Anko |
| Rocinante-XL-16B-v1 | TheDrummer | Nemo upscale | 2026-04-18 | 10.1 GB | 32.7 (2.8) | Iteration of Rocinante-X 12B; W/10 2.8 is a refusal flag |
| Qwen3.5-9B Uncensored (HauhauCS) | HauhauCS | Qwen3.5-9B | 2026-03-04 | 5.6 GB | base 39.5 think / 33.5 | Only fresh ≤8 GB reasoning option |

No new candidate from: Cydonia (v4.3 still latest), Sao10K (nothing since 2025-03), SicariusSicariiStuff
(Persona_Maker on old bases), zerofata beyond v2, Painted Fantasy.

### MeroMero v2 vs v1 — paired 3-seed screen on the current app (2026-09-17)

| Model | Obj | Spread | Restraint | StatDir | Format | LocAcc |
|---|---|---|---|---|---|---|
| meromero-31b-q4 (v1, **re-screened today**) | A/72 | 62–77 | 33 | 83 | 100 | 100% |
| meromero-v2-31b-q4 (i1 Q4_K_M) | B/65 | 65–65 | 0 | 100 | 100 | 100% |

**v1 keeps the No-Limit pick.** v2 gives back restraint for nothing: it over-fires on every no-op seed (Vigor −1
to −10 for tracing a door), v1 over-fires once in nine. v2 wins stat direction 100 vs 83 (one v1 miss) and is
the steadier of the two, but restraint carries 35% of the objective.

**v1's July A/84 is not reproducible on today's app** — it re-screens at A/72. The app changed under the
screen: stat updates now ship with native reasoning off (`thinking_budget_tokens: 0`) and a Max Output cap
sized from the stat count. Under that, **both Gemma-4 31B models spill their reasoning into the answer on
about half of all stat calls** (5/9 no-op turns each): an empty `<think></think>`, then "The user is asking
for stat changes…", cut off mid-sentence by the cap, with no `Stat: N` line ever reached. The app applies
nothing from such a reply, so the *player* sees a silently skipped stat pass; the scorer counts it as a fire.
In July, v1 reasoned in-band at length and concluded "No stats moved" — that path no longer exists at budget 0.
This is an app finding, not a model one: **stat updates on the built-in engine with a Gemma-4 reasoning model
are failing about half the time.** Not fixed here; it needs its own decision (budget > 0 for the stat pass, or
a `<think>`-aware parser that tolerates the spill).

Harness notes from the run: the enter dialog's **Start game** button and the contest **Got It** popup had
broken every screen since July (fixed in `run.mjs`); a seed crashed with `__baseline` gone from the page
(runner now logs page errors); the scorer padded a "3-seed" score with July dumps after that crash (now
refuses cross-day sets). The engine ran on **Vulkan** (prebuilt CUDA binary incompatible), ~18 min per seed.
`profiles.json` gained `meromero-v2-31b-q4` at `contextSize: 6144` because 8192 would not fit beside ~3.6 GB
of desktop apps on the GPU.

### Stat-pass reasoning probe (2026-09-17) — `stat-reasoning-probe.mjs`

Question: does the stat pass need native reasoning, and does a budget stop the spill above? Arms: `off` (shipped,
budget 0), `low` (shipped Low = 25% of the 112-token cap = 28 tokens), `think` (a real budget on top of the
cap). 11 gold cases (8 relevance + 3 gate idle turns), temp 0.2, built-in engine on Vulkan.

| Model | Arm | Clean | Spill | No-op clean | Spurious | ms/call |
|---|---|---|---|---|---|---|
| MeroMero v1 31B | off | 79% | 3/33 | 100% | 4 | 4,579 |
| | low (28 tok) | 82% | 1/33 | 100% | 7 | 4,801 |
| | think 150 tok | **88%** | **0** | 100% | 4 | 12,066 |
| | think 400 tok | 88% | 0 | 100% | 4 | 22,534 |
| MeroMero v2 31B | off | 85% | 3/33 | 100% | 2 | 4,340 |
| | low | 97% | 1/33 | 100% | 0 | 4,222 |
| | think 400 | **100%** | **0** | 100% | 0 | 19,820 |
| Cydonia 24B (8 runs) | off | 77% | 0 | 88% | 20 | 437 |
| | think 400 | 75% | 0 | 81% | 22 | 433 |
| Cloud E4B (5 runs) | off | 87% | 0 | 100% | 7 | 185 |
| | low | 84% | 0 | 100% | 10 | 161 |

**Findings.**
- **The spill is idle-turn-only.** Every spilled reply on both Gemma models was a no-op case: with no room to
  think, the model explains why nothing changed *in the answer* and the cap cuts it off. Rate here 3/33 per
  model; in the full-turn screen it was ~5/9 on idle turns, so richer context makes it worse.
- **A ~150-token budget removes it** and lifts clean rate on both Gemma models (v1 79→88, v2 85→100 at 400).
  150 and 400 score the same on v1; 150 costs 2.6× stat latency (4.6 s → 12 s per call), 400 costs 5×.
- **Shipped Low (28 tokens) is not enough** — the model fills it and still spills once in 33.
- **Non-reasoning models are unaffected.** Cydonia off vs think is inside noise at 8 runs (77 vs 75); the
  earlier 3-run dip was sampling. Its failures are the known belief-padding (Standing-from-morale,
  Coin-from-social). Cloud ignores the field.
- The remaining Gemma failures are model-level padding (Vigor on social-win, Resolve on rest) — the same
  residual the July stat probe found, budget or not.

**Effort levels — LM Studio, MeroMero v1, 2 runs (2026-09-17).** The `reasoning_effort` literal is an on/off
switch for Gemma 4 there, not a grade: `none` thinks 0 chars; `low`, `medium` and `high` all think ~900–980
chars, indistinguishable, and unbounded — 13 of 22 calls ran the thought into `max_tokens` and answered
nothing (clean 50–64%). `high` with `thinking_budget_tokens: 150` beside it thinks ~600 chars, never
truncates, 86% clean at 5.3 s/call — the same picture as the engine's 150-token arm. `none` was 91% clean
with 0 spills in 22 calls, so LM Studio's off path may be cleaner than the engine's (3/33); not separated
from noise at 2 runs. On the built-in engine the literal does not exist at all: node-llama-cpp 3.20 takes
only `budgets.thoughtTokens` per request (an effort literal exists only on its gpt-oss Harmony wrapper, at
construction), so an engine "level" can only be a budget preset. **Either way, the graded control for
Gemma 4 is the token budget.**

**The blocker is the budget model, not a number.** The app expresses a budget as a percent of the prompt's
max output, and the thought tokens live *inside* that cap. The stat cap is `16 × stats + 16`, so no percent
reaches 150 thought tokens on a 2- or 6-stat world. Fixing the spill means one of: a per-prompt token floor
for the budget with the cap raised to cover it; a cap that excludes thought tokens; or a parser that reads
stat lines after spilled prose plus a larger cap. That is a product decision — see [[stat-pass-reasoning-spill]].

### Workflow (2026-07-18): engine-only, Ollama dropped

Every model — catalog and reference — now screens through the built-in engine (`llmEngine.cjs`, port 8977)
straight off the LM Studio GGUFs (`<publisher>/<model>/file.gguf` under `D:\lmstudio-models`). Ollama was
dropped (its blob store double-stored ~100GB and it isn't needed once the engine reads GGUFs directly); the
only external endpoint left is the cloud default. `profiles.json` model entries use `modelPath` (engine) or a
per-model `endpointUrl` (cloud); it is gitignored, so this is local machine config.

## Open questions / gaps

- ~~Cydonia Q4 unscreened~~ **done 2026-07-17**: shipping Q4_K_M screens B/60 (3 seeds, 50–65), routing 100% —
  confirms the ≤16GB pick. Q6 proxy read B/65; the quant costs a few points but not the tier. The earlier
  violence-gate softening did not reproduce (0/3 at Q4, 1/5 seeds overall — noise).
- **tier4 (≤4GB) is a hole** — Impish LLAMA 4B (C/31) is the only member and it's weak, and the first backfill
  candidate **Qwen3.5-2B abliterated failed** (screened 2026-07-17): REJECT, routing 80% — it teleports to the
  Stable Yard on START GAME and misses the real move on turn 9, all 3 seeds. Tiny models keep failing routing;
  the tier may not be viable for this pipeline. Needs a different candidate or a decision to retire the tier.
- **A-tier rows are 1-seed / Ollama / old no-op turns** — meromero-31b & gemma31b-heretic (A/77) top the board
  on the weakest evidence. Re-screen 3-seed via the engine before treating the winner as settled.
- **Gemma-4 not in the catalog** — the two A/77 models are Gemma-4 31B; adding one is the highest-value change.
- **Untested catalog members** — Painted Fantasy 24B, Impish Bloodmoon 12B, Euryale 70B never screened
  (downloads/VRAM). Painted Fantasy shares Skyfall's Magistral base; Bloodmoon is Mistral-Nemo (never cleared B).
- **≤8GB has no reasoning option** — no RP reasoning finetune exists at ~8B. Revisit when one ships.
- **Skyfall's reasoning flag** — Magistral base (a reasoning model) but unflagged 🧠; behaved fine and leaked no
  `[THINK]`, so left as-is, but the flag is arguably wrong.
- Reference test tiers were pin-tuned on an older model pair; sampler pins not yet re-benchmarked on the
  Silver-Siren / MeroMero pair (see `test-models` memory).
- **Memory Digests' benefit is model-dependent and currently one-default-fits-all** (2026-07-22): the cloud
  tier needs condensation (bare history collapses it), strong locals like Cydonia are actively hurt by it on
  long sessions (silent by ~turn 42 vs perfect on bare). Default is now ON for fresh installs. Open decision:
  endpoint-gated defaults, a per-model recommendation surface, or accept the toggle as the escape hatch.
- **Voice-clause user-slot ship validated on 2 of the catalog's model classes only** (cloud + Cydonia-class,
  2026-07-22). The 12B/8B tiers and reasoning models are unmeasured on the new default narration user
  template — worth a screen pass before assuming the 3× transfers down-tier.

## Harness debt

- **Endpoint seeding — FIXED 2026-08-07.** `buildSeed` in `run.mjs` used to write
  `FORMAMORPH_useCustomEndpoint` plus the pre-preset `endpointUrl` / `apiToken` / `modelName` keys. None of
  those are read at runtime any more: engine runs only landed on the engine because the one-time
  `migrateEngineToPreset` converted the flag, and Ollama runs only worked because `seedTextPresetStore`
  folded the legacy URL keys into a "Custom" preset. Both are upgrade migrations kept for real users, not
  setup mechanisms — deleting either would have silently screened every engine model against the *hosted*
  endpoint, reading as an across-the-board score change rather than a config break.
  <br>`buildSeed` now writes `FORMAMORPH_textEndpointPresets` directly:
  `{activeId:'builtin-engine',presets:[]}` for engine models, a single `harness` preset for external ones,
  and sets the migration marker so the seed is authoritative. `maxTokens` / `contextWindowOverride` moved
  out of the flat settings pass-through into the preset's values (omitted unless a profile sets them, so
  the app's defaults layer underneath).
  <br>**Still unguarded:** `run.mjs` calls `main()` at import, so `buildSeed` can't be imported by a test.
  Extracting it into a module (as `screenScore.mjs` already is) would let a test assert engine models select
  `builtin-engine` and that no legacy keys are emitted. Worth doing next time the harness is touched.
