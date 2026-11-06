# Narration Architectures: Classifiers, Context Selection, Multi-Pass Generation

Research notes for deciding how Formamorph should pick context and structure a narration turn on small models (cloud Gemma-4 class, local 12B–31B). Primary sources only. Anything without a primary source is marked **UNVERIFIED**.

Researched 2026-11-06. The last section is our reasoning, not literature.

---

## 1. What classifiers and routers are for

| Use | What it decides | Typical implementation | Cost |
|---|---|---|---|
| Model routing (difficulty/cost) | Which model answers a query | Trained router, or a cascade with a scorer | Router is tiny next to the LLM; cascades pay for every rejected call |
| Intent routing | Which tool or flow handles a request | Embedding similarity to example utterances | Milliseconds, no generation |
| Retrieval gating | Whether to retrieve at all, and how much | Small trained classifier, or trained reflection tokens | One small-model pass |
| Moderation | Is the input or output unsafe | Fine-tuned 7B classifier LLM | One extra pass per side |
| Relevance filtering | Which passages enter the prompt | Embeddings, then a reranker | Embedding is cheap; LLM rerank is not |

**Model routing.**
- [RouteLLM](https://arxiv.org/abs/2406.18665) trains routers on preference data to pick a strong or weak model per query. It reports cost cuts of over 2x without losing quality. It tested four routers: matrix factorization, a BERT-base classifier, a Llama 3 8B "causal LLM classifier", and similarity-weighted ranking. Each routes to **one** model, so latency stays at one call.
- On MT Bench, the fine-tuned Llama 3 8B router was **never** the best router. With augmented training data it scored the lowest of the four (APGR 0.679 vs 0.802 for matrix factorization). Router size did not predict router quality ([RouteLLM, Table 1](https://arxiv.org/abs/2406.18665)).
- [FrugalGPT](https://arxiv.org/abs/2305.05176) uses a cascade: try a cheap model, score the answer with a **DistilBERT** regression scorer, and escalate if the score is low. It matches GPT-4 with up to 98% cost reduction on its tasks. The scorer is a small trained model, not a prompted LLM.
- [Hybrid LLM](https://arxiv.org/abs/2404.14618) routes by predicted difficulty and reports up to 40% fewer large-model calls with no quality drop.

**Intent routing.** [Semantic Router](https://github.com/aurelio-labs/semantic-router) compares the request to route examples in vector space and decides "in milliseconds". Its README pitches this as the alternative to "waiting for slow LLM generations".

**Retrieval gating.**
- [Adaptive-RAG](https://arxiv.org/abs/2403.14403) picks no-retrieval, single-step or multi-step retrieval with a trained **T5-Large** complexity classifier.
- [Self-RAG](https://arxiv.org/abs/2310.11511) trains the generator itself to emit reflection tokens that decide when to retrieve. It argues that retrieving a fixed number of passages every time "diminishes LM versatility".

**Moderation.** [Llama Guard](https://arxiv.org/abs/2312.06674) is a Llama 2 7B **instruction-tuned on a safety taxonomy**. It matches or beats existing moderation tools on its benchmarks. It is fine-tuned, not a prompted general model.

**Relevance filtering.** [RankGPT](https://arxiv.org/abs/2304.09542) shows that GPT-4-class models rerank well zero-shot. The paper's own efficiency fix is to distill that skill into a **440M** model, which beats a 3B supervised reranker on BEIR.

### Where prompted small LLMs fail as classifiers

- [Edwards & Camacho-Collados 2024](https://arxiv.org/abs/2403.17661), 16 datasets: fine-tuned RoBERTa beats zero- and few-shot prompted LLMs in most settings. The gap widens with more labels (multilabel micro-F1 0.788 vs 0.718). Prompting only wins when there are almost no labeled examples.
- The same paper finds an instruction-tuned **Flan-T5** beats the larger LLaMA 2 at zero-shot classification. Instruction tuning mattered more than size.
- [Bucher & Martini 2024](https://arxiv.org/abs/2406.08660): fine-tuned BERT-style models "consistently and significantly outperform" zero-shot GPT-3.5, GPT-4 and Claude Opus across sentiment, stance, emotion and party-position tasks.
- The shipped pattern across routing, gating and moderation is the same: **a small trained model or an embedding, not a prompted general LLM.** Where an LLM is the classifier (Llama Guard, RouteLLM's 8B router), it is fine-tuned for the job.

---

## 2. Context selection without an LLM call

Every shipped roleplay tool we checked selects lore by **keyword triggers plus a token budget**. Embeddings are an optional add-on. None of them documents an LLM call that decides relevance.

| Tool | How an entry gets in | Budget and priority |
|---|---|---|
| [SillyTavern World Info](https://github.com/SillyTavern/SillyTavern-Docs/blob/main/Usage/worldinfo.md) | Keyword in the last N messages (Scan Depth), names included by default. Recursive activation lets entries trigger entries. Optional secondary-key logic, probability, inclusion groups, sticky/cooldown/delay timers | Context % or token Budget. Constant entries first, then higher Order. Direct mentions outrank recursive ones. Once the budget is spent, nothing else enters |
| SillyTavern Vector Storage matching ([same doc](https://github.com/SillyTavern/SillyTavern-Docs/blob/main/Usage/worldinfo.md)) | Embedding similarity between recent messages and entry text **replaces only the keyword check**; every other filter still applies | "Max Entries" cap, inside the same budget |
| SillyTavern [Chat Vectorization](https://github.com/SillyTavern/SillyTavern-Docs/blob/main/extensions/Chat-vectorization.md) | Embeds old messages and moves relevant ones to the start or end of history | Ships with a disclaimer that it "does not guarantee a better chatting experience" |
| [NovelAI Lorebook](https://docs.novelai.net/en/text/lorebook/) | Case-insensitive keys (regex allowed, `&` for AND) within a Search Range of up to 10,000 characters. Always On option. Cascading activation from other context entries | Insertion Order sorts entries; Reserved Tokens and per-entry Token Budget; trim rules. Phrase bias can attach to an active entry |
| [AI Dungeon Story Cards](https://help.aidungeon.com/faq/story-cards) | Trigger words in player input **or** AI output. Activation lands on the **next** output. Stays active "a variable period depending on your context size" | Cards are "among the first elements to be removed from the context when it is full" |
| SillyTavern [group chats](https://github.com/SillyTavern/SillyTavern-Docs/blob/main/Usage/Characters/groupchats.md) | Picks the *speaker*, not lore: name mentions in the last message, then a per-character Talkativeness roll, then random | n/a |

- AI Dungeon's priority by "how recently and frequently" triggers fire appears in a Latitude Notion page that we could not load. **UNVERIFIED.**
- Why trimming can help at all: [Lost in the Middle](https://arxiv.org/abs/2307.03172) shows accuracy drops when the relevant fact sits mid-context, even for long-context models. Fewer, better-placed entries are a real gain, not only a token saving.

---

## 3. Multi-pass and multi-agent narrative generation

### Planner/writer splits

| System | Architecture | How outputs combine | Evaluation and result | Cost | Models |
|---|---|---|---|---|---|
| [Plan-and-Write](https://arxiv.org/abs/1811.05701) (2019) | Plan a storyline of keywords, then write | Plan conditions the writer | More diverse, coherent and on-topic than no-plan, automatic and human eval | 2 stages | BiLSTM seq2seq (pre-LLM) |
| [Re3](https://arxiv.org/abs/2210.06774) | Plan, draft by recursive reprompting, rerank continuations, edit for consistency | Plan + current story state reinjected each passage; Longformer rerankers pick the best continuation; an edit pass fixes facts | +14% coherent plot, +20% premise relevance vs same-model direct generation (human) | Many calls per passage: several sampled continuations, extraction calls, edit calls | GPT3-175B and InstructGPT3-175B; 13B for helper steps |
| [DOC](https://arxiv.org/abs/2212.10077) | Detailed hierarchical outline, then a controller that keeps passages on the outline | Outline item steers each passage | Beats Re3 by +22.5% plot coherence, +28.2% outline relevance, +20.7% interestingness | Authors report $3,000–4,000 of GPT-3 API spend and ~2,000 A100 hours for the project | InstructGPT3-175B outliner, OPT-175B drafter, OPT-350m controller |
| [Agents' Room](https://arxiv.org/abs/2410.02603) (Huot et al., ICLR 2025) | Four planning agents (conflict, character, setting, plot) write to a shared scratchpad; five writing agents each write one section | Deterministic orchestrator; story = concatenated sections | Expert raters prefer it over end-to-end baselines on every dimension; fine-tuned agents beat zero-shot | ~9 agent calls per story | Gemini 1.5 Flash; fine-tuning data from Gemini Ultra |
| [Dramatron](https://arxiv.org/abs/2209.14958) | Hierarchical prompt chain: title, characters, beats, locations, dialogue | Each level conditions the next | Qualitative study with 15 theatre and film professionals | One call per element per level | Chinchilla 70B |

**Small-model evidence.** Agents' Room reran zero-shot with **Gemma 2 9B**: the LLM judge preferred Agents' Room over end-to-end 80% overall ([Appendix, Table 4](https://arxiv.org/abs/2410.02603)). That is the best evidence we found that decomposition helps a small open model. Caveat: judged by Gemini 1.5 Pro, not humans.

### Director/actor designs

- [IBSEN](https://arxiv.org/abs/2407.01093): a director agent writes the plot outline, instructs actor agents per turn, checks objective completion, and rebuilds the plot when a human player acts. Outputs are interleaved as a dialogue script.
  - Results on 10 plays, 785 turns, gpt-3.5-turbo: objective-check F1 0.77 (precision 0.82, recall 0.72). Storyline logicality 2.96/4, coherence 3.63/4, **character consistency 2.77/4**.
  - Reported failures: repetition "still rather high"; the director "sometimes directly uses narration turns to substitute character turns"; actors overly positive about negative events. Frequent player actions make objectives less likely to complete.
  - Cost: director + one actor call per character turn + an objective check. No token counts given.
- [HoLLMwood](https://arxiv.org/abs/2406.11683): Writer drafts characters and outline, Editor gives feedback, Writer revises; then Actors role-play to deepen the plot.
  - GPT-4-judged pairwise win rates around 57–60% over baselines with GPT-4. More feedback rounds raise the win rate.
  - Cost: about **$5.6 per screenplay on GPT-4, $1.2 on GPT-3.5** for ~5,000 words.
  - **Small models broke it.** Format failure rates per stage were **45 / 58 / 85%** for Llama-2-7B and 38 / 48 / 78% for Llama-2-13B. The authors attribute this to weak instruction following on long contexts.

### Per-character agents stitched together

- [Generative Agents](https://arxiv.org/abs/2304.03442): each of 25 agents has a memory stream, reflections and plans; retrieval scores recency, importance and relevance. There is no narrator; the sandbox is the stitch.
  - Ablations show each component (observation, planning, reflection) adds believability.
  - Cost: 25 agents for two simulated days took "thousands of dollars in token credits" and multiple days, on gpt-3.5-turbo.
- SillyTavern [group chats](https://github.com/SillyTavern/SillyTavern-Docs/blob/main/Usage/Characters/groupchats.md) are per-speaker, not per-agent:
  - One call per reply; a reply-order strategy (Manual, Natural, List, Pooled) picks who speaks.
  - **Swap character cards** (default): only the active speaker's card is in context.
  - **Join character cards**: all members' cards are merged into one prompt, which the docs recommend when changing large chunks of context is undesirable, "e.g. with llama.cpp prompt caching". Muted characters can be included or excluded.
  - History is always shared between members. No evaluation is published.

### Critique and revise passes

- [Self-Refine](https://arxiv.org/abs/2303.17651): one model drafts, critiques and rewrites. About 20% absolute gains on GPT-3.5/4 across 7 tasks. With **Vicuna-13B** it "struggles significantly with the refinement process": it repeats its output or hallucinates a conversation.
- [Huang et al. 2023](https://arxiv.org/abs/2310.01798): without external feedback, LLMs struggle to self-correct reasoning and sometimes get worse.
- Re3's edit pass and HoLLMwood's Editor are critique/revise passes too; both ran on 175B-class or GPT-4-class models.

---

## 4. Failure modes of stitched multi-character output

| Failure | Evidence | Reported mitigation |
|---|---|---|
| Voice and persona drift | Measurable instruction drift within 8 rounds on LLaMA2-chat-70B and GPT-3.5, tied to attention decay ([Li et al. 2024](https://arxiv.org/abs/2402.10962)). IBSEN character consistency 2.77/4 | Split-softmax (same paper); director re-instructs actors each turn (IBSEN) |
| Homogenized voice | Generative Agents dialogue "overly formal" and agents "overly cooperative", which the authors blame on instruction tuning. Agents' Room raters noted a repeated "go-to vocabulary" | Fine-tuned role models ([RoleLLM](https://arxiv.org/abs/2310.00746)) |
| Contradictions and embellishment | Generative Agents "hallucinated embellishments"; 1.3% of awareness answers hallucinated. Re3 needed a dedicated edit pass for fact consistency | Re3 attribute-extraction + edit; retrieval from a memory stream |
| Lost scene continuity / role confusion | IBSEN director replaces character turns with narration; plots stall when the player acts often | Objective checks with forced completion after 9 turns (IBSEN) |
| Format collapse in pipelines | HoLLMwood 45–85% stage failures on 7B/13B | Fewer stages, simpler formats; none tested in the paper |
| Latency and cost | One call per agent per turn (IBSEN, Generative Agents); $1.2–5.6 per screenplay (HoLLMwood) | RouteLLM's one-call routing; SillyTavern's Join mode for prompt-cache reuse |

We found no paper that measures stitched multi-character narration on 12B–31B models for interactive play. **UNVERIFIED** that the failure rates above transfer to Cydonia- or MeroMero-class models.

---

## 5. Implications for Formamorph

> **Reasoning, not literature.** This section applies the sources above to our probe result: a prompted small-model tiering classifier (Focus / Background / Offstage) reached 87.8–93% recall against a 95% bar, its call cost more tokens than the trim saved, and narration was no worse with the trimmed context (leaning better on 31B).

The probe agrees with the literature: prompted general LLMs are weak classifiers, and shipped systems put a cheap deterministic or trained selector in front of the generator. Trimming itself looks worth keeping; the expensive part is the LLM deciding *what* to trim.

| # | Candidate | Why the evidence supports it | Risks |
|---|---|---|---|
| A | **Deterministic tiering**: keyword and name triggers, scene presence, recency, sticky timers, under a token budget | Every shipped RP tool works this way (SillyTavern, NovelAI, AI Dungeon). Zero extra calls. Lost-in-the-Middle says fewer entries can help | Misses entities referred to by pronoun or epithet; recall depends on author-supplied keys; tuning knobs leak to authors |
| B | **Embedding relevance on top of A**: embed entity cards once, score against recent turns, admit the top-k inside the same budget | SillyTavern's Vector Storage uses exactly this shape; Semantic Router shows millisecond decisions. No generation call | Needs an embedding model on every target (web, desktop, Android); similarity is not salience, so a mentioned-but-absent entity can outrank a silent present one; SillyTavern itself warns of no guaranteed gain |
| C | **Fold tiering into a call we already make**: the planning pass emits the entity tiers as a field of its existing output | Removes the extra call that made the classifier a net token loss. Agents' Room shows a planning stage helps even Gemma 2 9B | The 87.8–93% recall problem remains, now inside planning; a missed entity is silently dropped; adds format load that HoLLMwood shows small models fail under |
| D | **Recall-safe trim**: treat any selector's output as a demotion (full card to one-line stub), never a removal | Converts selector misses from "entity vanishes" into "entity is thin", which matters when recall sits under 95%. Keeps most of the token saving | Smaller saving than full removal; stubs may still pull the narrator toward offstage entities |
| E | **Trained small classifier** (embedding head or a tiny fine-tuned encoder) for tiering | Edwards, Bucher, FrugalGPT, Adaptive-RAG and Llama Guard all favor trained small models over prompted LLMs | Needs labeled data from our own sessions; another model to ship on all platforms; drift as world formats change |

What the evidence does **not** support for us:
- **Per-character agent stitching** (IBSEN, Generative Agents) on 12B–31B: one call per character per turn, measured consistency problems even on GPT-3.5, and format collapse on 7B/13B in HoLLMwood.
- **Self-critique passes** on local models: Self-Refine broke on Vicuna-13B.

If we revisit either, the cloud model is the only tier with any published support.
