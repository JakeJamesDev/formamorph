# Thinking Modes — Design Memo

> Internal design note (not wiki-published). Status: **proposal, nothing built.** Grounded in SillyTavern's shipped reasoning mechanics and community thinking-prompt practice — see Sources.

## Why now

MeroMero (a native-reasoning local model) empties `content` and stalls in Formamorph because its native thinking fires uncontrolled. Fixing that surfaced a bigger question: how should Formamorph's four thinking modes relate to how reasoning models are *actually* used in the wild? This memo settles the model layout and specs the near-term Inline hardening.

## The key insight

There are **two independent axes**, and Formamorph currently conflates them:

| Axis | Who drives it | Controllable? |
|---|---|---|
| **Native reasoning** | The *model* decides to think (emits its own `<think>` or a separate `reasoning` field) | Only where the backend allows it — verbose, censorship-prone, model-specific |
| **Guided reasoning** | *We* prompt a short reasoning step in the request | Fully — works on **any** model, bounded by our prompt |

The community consensus (r/SillyTavAI + ST docs): guided/"fake" reasoning is the **robust, universal** path; native reasoning helps **continuity and instruction-adherence at long context, not prose**, and only on a few models (GLM, Kimi). The named pain point is **verbose reasoning dwarfing the output**.

So: guided reasoning is the feature; native reasoning is mostly **interference to suppress** when a guided mode is active.

## Proposed mode layout

A complexity ladder. Native reasoning is an **orthogonal** control, not a fifth mode.

| Mode | What it does | Formamorph-specific? |
|---|---|---|
| **Native** (rename of *Off*) | We add no guidance. If the model reasons natively, we let it; if not, nothing changes. Today's default behavior — just honestly named. | — |
| **Inline** | Appends a `<think>` directive to the **same** narration request; model thinks then writes prose in one completion; block parsed out. This **is** ST's "fake reasoning." | Universal |
| **Planning** | Separate hidden plan call (Scene/Cast/Beats) whose parsed output feeds in-app features (entity parsing) the raw LLM can't reach. | ✅ value-add |
| **Staged** | Planning+: director → character(s) → storyboarder pipeline for features impossible with a single LLM. In infancy. | ✅ value-add |

### The orthogonal control: native-reasoning suppression

- **Native mode** → show the **Reasoning Effort** selector (Auto/Min/…/Max). It's a no-op on non-reasoning models — accept that; ST does the same.
- **Inline / Planning / Staged** (guided modes) → **suppress native reasoning** (`reasoning_effort:none`) so the model's own thinking doesn't fire *on top of* our guided step. This is also the MeroMero "no output" fix.
  - **Open decision:** force-suppress in guided modes, or expose it so a user on GLM/Kimi could deliberately stack native + guided? Recommend **force-suppress by default** with an advanced escape hatch later.

### API capability detection — don't

There's no standard way to detect whether a model reasons. `/v1/models` carries no capability flag; local backends don't advertise it. So **always show Reasoning Effort under Native** and accept it's inert on non-reasoning models. (Matches ST — the setting exists regardless of support.)

## Inline hardening spec

Today's `INLINE_THINKING_DIRECTIVE` is unbounded narrator-continuity guidance. The community prompts converge on a tight structure worth adopting. Common shape across ST's stepped-thinking presets:

1. **Mode-switch signal** — nearly all open with *"Pause your roleplay."*
2. **Short enumerated steps** — a fixed list of *what to consider*, not open-ended.
3. **Hard length cap** — "2–4 points." The direct fix for verbosity.
4. **First-person / in-voice.**
5. **Opener prefill** — several force `Start with: "<think> Okay,"` (the Start-Reply-With trick) to guarantee the tag.
6. **Tag wrap** — `<think></think>` dominant.

**Adaptation for Formamorph:** ST's presets are *character-thought* oriented (NPC feelings/plans); our Inline is *narrator/continuity* oriented. Keep our orientation, borrow the structure. Target directive shape:

> Before the narration, in a `<think></think>` block, plan the turn in **3–4 short bullets**: who is present and what they want, who knows what, positioning/state carried from last turn, and the single beat this turn must land. Keep it terse — no prose. Then write the narration.

Bounding to 3–4 bullets is the whole point: it captures the continuity value ST users prize without the verbose ramble they complain about.

## `<think>` block UI (Slice 3 — spec'd, next to build; version 2.1.0)

Player-facing collapsible reasoning aside, **below the player action, above that turn's narration** — one block per turn. Interview-locked spec:

| Aspect | Decision |
|---|---|
| **Appears for** | **Native** (a native reasoning model's own thinking, from the `reasoning` stream field or an inline `<think>` in content) + **Inline** (the injected `<think>`). Planning/Staged keep their separate hidden plan in the debug view only. |
| **Live behavior** | Streams live into an **expanded** block while the model reasons, **auto-collapses** the moment narration begins (ChatGPT/Claude pattern). Click to re-expand. |
| **Header** | `Thinking…` + spinner while active → **`Thought for Ns`** once done (wall-clock: reasoning start → narration start). |
| **Rendering** | Full markdown (same pipeline as narration) but in a **de-emphasized container** — muted color, smaller size/line-height, down-scaled headings so a stray `#` doesn't shout. |
| **Setting** | New **"Show reasoning"** toggle (Generation area), **default ON**, collapsed. OFF hides it. |
| **When OFF** | Still **captured & saved**, just hidden — turning it back on reveals it on those turns. |
| **Persistence** | **Saved per-turn** in the save envelope (additive `reasoning` field — likely `{ text, ms }`). Survives reload, shows in scrollback, travels with exported saves. |
| **Empty reasoning** | No block rendered. |
| **Motion** | Expand/collapse respects `prefers-reduced-motion`. |

**Save-shape change → version.** This is an additive save `.json` shape change; the user bumped `package.json` to **2.1.0** (in-development, not released) on 2026-07-09 specifically to carry it. Old saves lack the field and load fine (presence-based). Remind on the actual code change.

**Plumbing to confirm at build:** capture the streaming `reasoning` delta (native) AND the inline `<think>` span in content (`stripReasoning` already isolates the latter); measure `ms` from first reasoning token to first narration token.

## Open decisions

- [x] **Force-suppress native reasoning in guided modes (Slice 1, shipped).** Inline/Planning/Staged send `reasoning_effort:none` on every call (`reasoningEffortBody` returns `none` for any non-`off` mode) so the model's own thinking can't fight the guided step — Planning is outright incompatible with it. Omitted when the endpoint can't accept `none`. Unit-tested.
- [ ] Exact Inline directive wording + cap (3 vs 4 bullets) — tune on MeroMero + Silver-Siren via the probes.
- [x] **`<think>`-block UI (Slice 3) spec locked** — see the section above; next to build under 2.1.0 (save-shape change).
- [x] **Per-prompt reasoning (Slice 2, shipped).** Native mode only. Narration + Choices (`REASONING_CONTROL_KINDS`) get a `Global | None | <levels>` control in their Options tab (narration default Global, choices default None); all other prompts hardwired `none`. `Global` inherits Settings → Generation → Native Reasoning, which now only feeds `Global`-set prompts — it no longer applies to a request on its own. Disabled under the Default preset (via the existing `activePresetIsBuiltIn` lock). Stored in `FORMAMORPH_promptReasoning` (settings, not export shape). Resolved per-requestType in `makeAIRequest` via `resolvePromptReasoning` → `reasoningEffortBody`. Pure logic unit-tested; UI verified (narration=Global, choices=None, bookkeeping prompts show no control, hidden in guided modes).
- [x] **Cloud endpoint tolerates `reasoning_effort`** — probe-verified against `api.lyonade.net`: **rejects the literal `auto` (HTTP 400)** but accepts the real levels (`none`/`minimal`/`low`/`medium`/`high`/`xhigh`/`max` all 200). `auto` isn't a wire value anywhere — every backend 400s on it — so "Default" = omit the field.
- [x] **Endpoint-aware levels (shipped).** Rather than hard-code one set, the app probes each endpoint on connect (`detectSupportedReasoningEfforts`) and shows only accepted levels — remembers each `endpoint|model` in a bounded map (cap 30) so switching endpoints/models reads from cache instead of re-probing, falls back to the universal `none/low/medium/high` when offline/inconclusive. Verified live: cloud → all seven; Ollama → `none/low/medium/high/max` (no `minimal`); LM Studio offline → safe fallback. Native mode wired via `reasoningEffortBody(mode, effort, supported)` (also omits a level the endpoint doesn't accept, so a stale pick can't 400 a turn). All pure logic in `src/lib/reasoningEffort.ts`, unit-tested. Guided modes still send nothing (first open item above).

## Sources

- [ST Reasoning docs](https://docs.sillytavern.app/usage/prompts/reasoning/) — Request model reasoning, Reasoning Effort, Auto-Parse, Add to Prompts; native suppression only for Claude/Google/Z.AI(GLM)/Moonshot(Kimi)/OpenRouter.
- [st-stepped-thinking — Prompts for thinking](https://github.com/cierru/st-stepped-thinking/wiki/Prompts-for-thinking) — community thinking-prompt corpus (Xel, Nitral, Garpagan, Adeor, et al.).
- [DavidAU — How to Use Reasoning/Thinking Models](https://huggingface.co/DavidAU/How-To-Use-Reasoning-Thinking-Models-and-Create-Them) — universal `<think></think>` system prompt, temp guidance.
