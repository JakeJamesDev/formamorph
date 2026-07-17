# Model Research — findings & methodology

> **Why this doc exists:** so every "what models should we recommend/test?" request starts from the same
> baseline instead of re-deriving (and getting different answers each time). When asked for model info,
> **read this first, refresh only what's stale, then update this doc** with the new numbers + date.

**Last updated:** 2026-07-17 (policy flipped to per-model eligibility; Model profile + gate-probe results)

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

## Current recommended catalog (desktop app) — data as of 2026-07

Source of truth is [`src/lib/localModels.ts`](../src/lib/localModels.ts); this mirrors it with provenance.
Tiers by VRAM ceiling: ≤4 / ≤8 / ≤16 / No-Limit. 🧠 = reasoning badge.

| Tier | Model | GGUF repo | Size | Released | Downloads |
|---|---|---|---|---|---|
| ≤4GB | 🧠 Qwen3-4B RPG Roleplay v2 | Chun121/Qwen3-4B-RPG-Roleplay-V2 | 2.5GB | 2025-07 | 120K |
| ≤4GB | Gemmasutra Small 4B | TheDrummer/Gemmasutra-Small-4B-v1-GGUF | 2.5GB | 2025-03 | 111K |
| ≤4GB | Impish LLAMA 4B | SicariusSicariiStuff/Impish_LLAMA_4B_GGUF | 2.8GB | 2025-07 | 20K |
| ≤4GB | Gemmasutra Mini 2B | TheDrummer/Gemmasutra-Mini-2B-v1-GGUF | 1.7GB | 2024-08 | 1.2M |
| ≤8GB | Wingless Imp 8B | mradermacher/Wingless_Imp_8B-GGUF | 4.9GB | 2025-02 | 3.4K |
| ≤8GB | Anubis Mini 8B | TheDrummer/Anubis-Mini-8B-v1-GGUF | 4.9GB | 2026-01 | 12K |
| ≤8GB | Stheno v3.4 8B | bartowski/Llama-3.1-8B-Stheno-v3.4-GGUF | 4.9GB | 2024-09 | 42K |
| ≤8GB | Lunaris v1 8B | bartowski/L3-8B-Lunaris-v1-GGUF | 4.9GB | 2024-06 | 154K |
| ≤16GB | Cydonia 24B v4.3 | TheDrummer/Cydonia-24B-v4.3-GGUF | 14.3GB | 2025-11 | 117K |
| ≤16GB | Painted Fantasy 24B v4.1 | zerofata/MS3.2-PaintedFantasy-v4.1-24B-GGUF | 14.3GB | 2026-02 | 8.6K |
| ≤16GB | Rocinante-X 12B | TheDrummer/Rocinante-X-12B-v1-GGUF | 7.5GB | 2026-01 | 45K |
| ≤16GB | Impish Bloodmoon 12B | SicariusSicariiStuff/Impish_Bloodmoon_12B_GGUF | 7.5GB | 2025-12 | 32K |
| No-Limit | 🧠 Qwen3.6 35B-A3B Anko | bartowski/allura-org_Qwen3.6-35B-A3B-Anko-GGUF | 21.4GB | 2026-04 | 26K |
| No-Limit | Skyfall 31B v4.2 | TheDrummer/Skyfall-31B-v4.2-GGUF | 19.0GB | 2026-02 | 34K |
| No-Limit | Euryale 70B v2.3 | bartowski/L3.3-70B-Euryale-v2.3-GGUF | 42.5GB | 2024-12 | 38K |

The app also refreshes these download counts live at runtime (`src/lib/useCatalogDownloads.ts`) and caches
them; the numbers above are the bundled snapshot / fallback.

### Notable rejects (don't re-propose without reason)
- **gemma-4 heretic** family (E4B/12B/26B-A4B) — ~~excluded by the RP-only policy~~ **no longer a reject**: the
  policy flipped 2026-07-17 and general decensored models are eligible. Not yet added — a candidate needs a
  screen run first. `gemma31b-heretic` scored A/77 on the gate probe, tied with the RP MeroMero-31B.
- **Magnum v4 72B** — dropped; Qwen2.5-era, superseded.
- **Qwen3.6-35B-A3B base** — replaced by the allura **Anko** RP finetune.

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
are the *reference test tiers*, not catalog entries — no shipped model has been through the screen yet.

**Caveats:** n=3–4, single world, content bounded at what the Claude judge can grade (hardest refusals
unprobed). The Mistral general control is `Heretic-v2` (the natong19 abliterated GGUFs won't load in current
llama.cpp — broken tool template).

## Open questions / gaps

- **≤8GB has no reasoning option** — no RP reasoning finetune exists at ~8B. Revisit when one ships.
- **Cydonia 24B** can reason via `[THINK]` prefill but isn't native — left unbadged, noted.
- Reference test tiers were pin-tuned on an older model pair; sampler pins not yet re-benchmarked on the
  Silver-Siren / MeroMero pair (see `test-models` memory).
