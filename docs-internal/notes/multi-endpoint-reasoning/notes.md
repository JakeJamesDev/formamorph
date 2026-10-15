# Multi-endpoint reasoning: how others do it

Research for the fixed thinking room effort (2026-10-14). Sources and citations live in the two detail files:

- [providers.md](providers.md): OpenAI, Anthropic, Gemini, OpenRouter, LiteLLM, Vercel AI SDK, vLLM, llama.cpp, Novita.
- [clients.md](clients.md): SillyTavern, Open WebUI, LibreChat, Cline, Roo Code, Aider, Continue, KoboldCpp, Jan, LobeChat, Cherry Studio.

## The common pattern

| Question | What the field does |
|---|---|
| Does `max_tokens` include reasoning? | Yes, on every API checked. No API gives reasoning its own cap. |
| Where does the budget sit? | Most clients: inside `max_tokens`, as a fraction. Vercel AI SDK: added on top. |
| Effort → budget | Fractions of the output cap (Low ≈ 0.1–0.25, High ≈ 0.5–0.8), or fixed numbers (LiteLLM 1,024 / 2,048 / 4,096). |
| Floor | 1,024 tokens nearly everywhere. |
| Thought never ends, hosted API | Truncate with `finish_reason: length`. Nobody recovers. Cline and Roo Code retry, then fail. |
| Thought never ends, local server | The server forces the end-of-thinking tag at a budget, then the model answers (llama.cpp `reasoning_budget_tokens`, vLLM `thinking_token_budget`, KoboldCpp). |
| Off switch | Sent explicitly (`reasoning_effort: "none"`), since leaving it out keeps always-on models thinking. |
| Endpoint model | Describe each endpoint by the shape of its control (effort, budget, toggle). Cline, Cherry Studio and LibreChat do this. |

## What it means for our rulings

- **Fixed sizes (Q2, Q8) fit our case.** Fractions fail when the answer cap is 11 tokens, which is the Novita bug. LiteLLM and Gemini's compat layer also use fixed numbers.
- **Additive room (Q3) has precedent** in the Vercel AI SDK.
- **The clear error (Q4) matches the field.** No one recovers a cut thought on a hosted API.
- **The explicit off on llama.cpp (Q5) matches Cline.**
- **The llama.cpp limit (Q6) has a simpler standard form.** `reasoning_budget_tokens` per request makes the server end the thought itself. Jan sends it on every llama.cpp request. `reasoning_control` + `reasoning_end` exists, but its handler reports success even when no thought was cut.
