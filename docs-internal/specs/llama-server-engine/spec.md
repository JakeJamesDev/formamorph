# Llama Server Engine

Status: done
Status note: 2026-10-23, tickets 01–13 done, last landing 720794622. Closed with gaps: tickets 14–16 (cache RAM limit, reload diff after V coercion, share buffer set); 14 wontfix (T14); 15–18 done after the close, last landing 5cc3d99d0. Spec text corrected. Gates green on 2026-10-23 (lint, test).
Target branch: engine/llama-server
Spec session: llama-server-engine — spec

## Problem Statement

The desktop app runs local models through a bundled engine built on node-llama-cpp. node-llama-cpp wraps llama.cpp at a high level and leaves out several llama.cpp controls that players ask for.

- A player can't keep the context (the KV cache) in system RAM when VRAM is full. LM Studio has this as **Offload KV Cache to GPU Memory**. node-llama-cpp never sets llama.cpp's `offload_kqv`.
- A player can't quantize the KV cache to fit a longer context. node-llama-cpp marks the option experimental. Its memory estimate for a quantized cache is wrong by about 17× for Q8_0, so a load that fits gets refused.
- **Flash Attention** can't really be turned off. An unchecked box sends nothing, and the engine runs Flash Attention on auto.
- Our copy says **Parallel Requests** split the context. In fact, each request gets the full **Context Size**, and auto layer fitting reserves KV memory for one request only.
- Local models drop every image, even vision models.
- New model architectures reach llama.cpp first and node-llama-cpp later.

## Solution

The desktop engine runs llama.cpp's own `llama-server`, the same runtime LM Studio uses for GGUF models. node-llama-cpp leaves the app.

- The app ships `llama-server` builds for Windows (Vulkan + CPU), macOS (Metal) and Linux (Vulkan + CPU) inside the installer.
- `llama-server` runs in router mode, so the Local Model status keeps its load percentage.
- A thin proxy of ours sits between the app and `llama-server`. It keeps today's request behavior where the switch would otherwise change it, and applies the new **Context Overflow** setting.
- Every existing engine setting maps to a `llama-server` flag. Existing stored values keep working.
- The Local Model panel gains the settings LM Studio has: **K Cache Type**, **V Cache Type**, **KV Cache in RAM**, **Unified KV Cache** and **Context Overflow**.
- A model with a vision projector beside it can see images.
- The VRAM viewer keeps its GPU bars. The Formamorph share, the device line and the free-at-load figure get new sources.
- The work lives on its own branch and merges to main once, when it clears the merge bar. Releases keep shipping from main meanwhile.

## User Stories

1. As a player with a small GPU, I want to keep the context in system RAM, so that a model whose weights fit in VRAM still loads with a long context.
2. As a player, I want to set the K cache type to F16, Q8_0 or Q4_0, so that I can trade a little quality for a longer context.
3. As a player, I want to set the V cache type apart from the K cache type, so that I can quantize only one of them.
4. As a player, I want to quantize only the K cache without Flash Attention, so that a GPU that can't run Flash Attention still saves memory.
5. As a player, I want a quantized V cache to require Flash Attention, so that I can't pick a combination that fails to load.
6. As a player, I want Flash Attention off to really turn it off, so that an old GPU that can't run it still loads models.
7. As a player who unchecked Flash Attention before, I want my choice to stay, so that the update doesn't change a setting I set on purpose.
8. As a player, I want Flash Attention on by default, so that a new install uses less VRAM and runs faster.
9. As a player, I want a **Unified KV Cache** toggle, so that I can choose between one shared context pool and a full context for every parallel request.
10. As a player, I want Unified KV Cache on by default, so that parallel requests use less VRAM, as in LM Studio.
11. As a player, I want to turn Unified KV Cache off, so that each parallel request gets the full Context Size when I have the VRAM.
12. As a player, I want the Parallel Requests copy to say what really happens to the context, so that I size Context Size correctly.
13. As a player, I want a **Context Overflow** setting, so that I choose what happens when a request is longer than the context.
14. As a player, I want Truncate Middle by default, so that the world's system prompt and my first message always stay in what the model sees.
15. As a player, I want Rolling Window, so that the oldest messages drop first when I prefer that.
16. As a player, I want Stop at Limit, so that a too-long request stops and tells me instead of losing story.
17. As a player, I want overflow handling to cut whole messages, so that the model never sees half a message.
18. As a player with a vision model, I want local models to see the images in my story, so that scene images and character cards reach the narrator.
19. As a player, I want the app to find a model's vision projector beside the model file, so that I don't configure it by hand.
20. As a player, I want a recommended vision model to download its projector with it, so that images work after one download.
21. As a player with a text-only model, I want images dropped as today, so that a turn with an image still answers.
22. As a player, I want the app to tell me when images were dropped, so that I know the model didn't see them.
23. As a player, I want the load percentage while a model loads, so that I know a large model is still moving.
24. As a player, I want the engine to fall back to the CPU when the GPU build can't load, so that a model still runs on a machine with a bad driver.
25. As a player, I want the status line to name the backend, so that I can see when I'm running on the CPU.
26. As a player, I want my Context Size, GPU Layers, GPU Device, Parallel Requests and Auto-Load settings to carry over, so that the update loads my model the way it did before.
27. As a player, I want my GPU Device choice to survive a driver update, so that the engine keeps using the card I picked.
28. As a player, I want GPU Layers Auto to fit the model and its context into VRAM, so that Auto never runs out of memory.
29. As a player, I want GPU Layers Max and Custom to work as today, so that I keep control over the split.
30. As a player, I want a load that doesn't fit to say which setting to lower, in the panel's setting names, so that I can fix it.
31. As a player, I want the VRAM viewer to keep its GPU bars, so that I still see how full the card is.
32. As a player, I want the viewer to show how much VRAM Formamorph uses, so that I can tell our share from other apps.
33. As a player, I want the device line to show the GPU name, its total VRAM and the free VRAM at load, so that a wrong-device problem is visible.
34. As a player, I want sampling settings (Temperature, Top-p, Top-k, Min-p, Repetition Penalty, Max Output Tokens) to keep working, so that my tuned values still apply.
35. As a player, I want structured output and my Extra Parameters to reach local models, so that local models follow the same request as a custom endpoint.
36. As a player, I want the reasoning budget to keep working on local models, so that thinking models stay fast when I cap them.
37. As a player, I want the model's raw `<think>` text to reach the app as today, so that choices, stats and the raw-output viewer keep working with thinking models.
38. As a player, I want closing the app to free the GPU, so that no hidden process keeps my VRAM.
39. As a player, I want a crash of the app to free the GPU too, so that I don't have to find and kill a process.
40. As a player, I want the engine to answer the app's model-list probe, so that the endpoint shows as reachable with the model loaded.
41. As a player on macOS or Linux, I want the same engine and settings, so that the platforms don't drift apart.
42. As a player reading the changelog, I want the Unified KV Cache default and the Flash Attention change named, so that I know what to change if a turn behaves differently.
43. As a player reading the help, I want every new setting described in Settings help and in Formaquestion, so that I can find what each one does.
44. As the developer, I want the engine on its own branch, so that releases ship from main until the switch is ready.
45. As the developer, I want the bundled llama.cpp version pinned, so that two builds of one commit ship the same engine.
46. As the developer, I want the release ritual to check for a newer llama.cpp build and bump the pin, so that the engine stays current through a checked step.
47. As the developer, I want recorded `llama-server` output as test fixtures, so that a format change in a version bump fails a test instead of breaking the viewer.
48. As the developer, I want a settings load matrix against the real binary, so that every setting combination is proven to load and answer before merge.
49. As the developer, I want a packaged-build smoke test, so that the installed app starts, loads, serves and frees the GPU.
50. As the developer, I want parity probes against the old engine, so that narration changes from the switch are measured.

## Implementation Decisions

**Branch and landing**
- The work lives on `engine/llama-server` in its own worktree. Ticket worktrees branch from it and land on it, not on main. Main merges into it after each release. It merges to main once, when the merge bar is met.

**Binaries**
- The installer bundles `llama-server` builds from llama.cpp's GitHub releases: Windows Vulkan x64 (it carries the CPU backends too), macOS arm64 and x64 (Metal), and Linux x64 as two builds, Vulkan and CPU, so the engine can fall back to the CPU one. Windows and Linux arm64 are not bundled, and neither is CUDA.
- The pin is one literal tag committed in the repo, such as `b11829`. The build never resolves "latest", because every llama.cpp release is flagged prerelease.
- One pinned llama.cpp build tag names the version. The build fetches exactly that tag. The `release` skill gains a step that checks for a newer build and bumps the pin, followed by the parser tests and the load matrix.
- node-llama-cpp and its prebuilt packages leave the dependencies and the packaging rules.

**Process**
- `llama-server` runs in router mode, loading the model from a one-section `--models-preset` file written per start (T02-1). The engine loads and unloads models through the router API and reads load progress from its status event stream. The README and the code disagree on that event's name, so a test pins the name the pinned build emits.
- The engine host keeps its current role and its public contract: `start(options)`, `stop()`, `getState()`, `onStatus()`, the device listing, and the status shape the renderer reads. Its internals spawn and supervise `llama-server`.
- The `llama-server` process dies with the app, including on a crash (a Windows Job Object or the platform's equivalent). The process the VRAM viewer attributes to Formamorph is the router's model instance (T04-2).
- The engine passes `-np` (Parallel Requests) every time, because the server's auto default forces four slots.
- When a GPU load fails, the engine retries once on the CPU and reports the CPU backend in its status.

**Settings → server arguments**

| Setting | Server argument | Note |
|---|---|---|
| Context Size | `-c` | With Unified KV Cache off, the engine passes Context Size × Parallel Requests, so each slot gets the full Context Size |
| GPU Layers Auto / Max / Custom | `-ngl auto` with fit on / `-ngl all` with `--fit off` / `-ngl N` with `--fit off` (T02-3) | llama.cpp's own fit replaces our `fitContext` workaround |
| GPU Device | Resolved by name against `--list-devices` on each start | Keep pin-by-name. `--device` is the only pinning scheme (T02-2) |
| Flash Attention | `-fa on` / `-fa off` | Off means off. Stored values stay |
| Parallel Requests | `-np N` | Always passed |
| Unified KV Cache (new) | `--kv-unified` on or off | Default on |
| K Cache Type (new) | `-ctk f16 / q8_0 / q4_0` | Default F16 |
| V Cache Type (new) | `-ctv f16 / q8_0 / q4_0` | Default F16. A quantized V requires Flash Attention on |
| KV Cache in RAM (new) | `-nkvo` when on | Default off (KV on the GPU) |
| Image input (new) | `mmproj = <file>` in the preset section | Only when a projector is found |
| Prompt cache | Slot prompt reuse on, `--cache-ram` left at the server default (8192 MiB) | Matches LM Studio (ruling T14) |

- Each new setting follows the existing engine-setting path: a default beside the others, a validated persisted value, the `setOptions` IPC, the main process's boot options and reload diff, and the applied value in the engine status. The renderer's boot default and the main process's boot options stay equal, so a fresh start doesn't reload.
- The new rows sit in the Local Model panel under **Advanced**, next to the other engine rows. They apply on reload, except Context Overflow (T07-5). A quantized V cache type turns Flash Attention on or blocks the choice while it is off. The exact control is a design-system decision.
- The Parallel Requests copy and the code comments state the real behavior for both Unified KV Cache states.

**Proxy**
- A thin proxy of ours fronts `llama-server` on the engine's current port. It keeps today's request behavior where the switch would otherwise change it:
  - It strips image parts when the loaded model has no projector, and sets the images-dropped header with the count.
  - It merges all system messages into one at the top and treats messages the way the current engine does, so templates that reject extra system messages or trailing assistant turns keep working.
  - It answers every `*/models` path, including the LM Studio-style probe, with the loaded model's id and state.
  - It restates load and context errors in the panel's setting names.
  - It applies the Context Overflow policy (below).
- It passes these through unchanged: `response_format`, Extra Parameters, sampling fields, both penalty spellings, the reasoning budget fields, `chat_template_kwargs`, and `seed`.
- Reasoning output stays raw: `--reasoning-format none`, so `<think>` text reaches the app in `content` as today. A ticket verifies that the opening tag survives when a template's generation prompt opens it.

**Context Overflow (new setting)**
- Three policies, matching LM Studio's `contextOverflowPolicy`: **Truncate Middle** (default), **Rolling Window** and **Stop at Limit**.
- The proxy applies the policy to whole messages before the prompt reaches `llama-server`. Truncate Middle keeps the system prompt and the first user message and drops messages from the middle. Rolling Window drops the oldest messages first. Stop at Limit returns a context-length stop the app can show.
- Token counts come from the server's tokenizer, so the cut matches what the model sees.

**Images**
- A projector pairs with a model by the rules in T08-1. The engine pairs them when it loads the model.
- Recommended catalog entries for vision models list their projector, and the download fetches both.

**VRAM viewer**
- The GPU bars stay on nvidia-smi in the main process. They don't depend on the engine.
- The Formamorph share is the sum of the non-host buffer sizes `llama-server` logs at load, across the devices the instance uses (T04-3).
- The free-at-load figure comes from the "using device … MiB free" log line. The total, the device names and the backend come from `--list-devices`, run once per device enumeration, never polled.
- The share is llama.cpp's own allocation. It leaves out driver overhead, so it reads a little lower than today's delta figure.

**Status shape**
- The engine status gains the applied values of the new settings. Its existing fields keep their names and meanings.

## Testing Decisions

- A good test drives a public boundary and checks what a caller sees: arguments sent, status pushed, the HTTP response. It never checks private helpers or call order.
- **Seam 1, the engine module's public contract.** Tests drive `start`, `stop`, `getState`, `onStatus` and the proxy routes against a fake `llama-server`: an injected spawn stub that replays recorded router events and log lines and answers HTTP like the real server. This seam covers:
  - settings → server arguments, for every row of the table above
  - load progress from the router events
  - the VRAM share, free-at-load and device fields from the recorded logs
  - CPU fallback after a failed GPU load
  - load-error wording
  - image stripping and the header, system-message merging, the `*/models` answer
  - all three Context Overflow policies, including that the cut falls on message boundaries
  - pass-through of `response_format`, Extra Parameters and the reasoning fields
  - stop freeing the process
  Prior art: the engine's existing status-shape and transition tests.
- The recorded fixtures come from a real `llama-server` run at the pinned tag. A version bump re-records them, so a format change fails a test.
- **Seam 2, the Local Model panel.** It covers the new rows, the reload diff, Reset, the V-type/Flash Attention rule, and the `setOptions` payload. Prior art: the panel's existing tests with a stubbed desktop bridge.
- Every guard is proven to bite by reinstating the bug once (the `test-bar` skill).
- **Seam 3, the real binary, outside the gates.** A script runs the real `llama-server` on this PC. Each setting combination loads a model and answers one request: K/V types, Flash Attention, Unified KV Cache, KV Cache in RAM, device, and layer modes. The script also checks that no process holds VRAM after stop. A packaged-build smoke test does the same from the installed app.
- **Merge bar:** the load matrix, the packaged-build smoke test, and the four gates green on the branch.
- **Parity probes** (wanted, not blocking): the baseline harness on Cydonia, old engine vs `llama-server`, with an in-batch control. They watch paragraph breaks and repetition, because llama-server's repetition penalty also counts prompt tokens and line breaks.
- macOS and Linux are proven by a CI build and the unit tests only. Runtime checks there wait for someone with the hardware.

## Out of Scope

- CUDA builds on Windows.
- Changing request behavior beyond what is listed under Proxy. Prompt shape, message handling and sampling pins stay as today.
- Matching node-llama-cpp's repetition-penalty window. The change is accepted and measured.
- A live VRAM readout on AMD and Intel GPUs. The viewer stays as it is there today.
- Per-process VRAM rows on Windows GeForce. nvidia-smi doesn't report them under WDDM, and that is unchanged.
- Loading more than one model at a time through the router.
- An in-app notice about the changed defaults. The changelog covers it.

## Rulings

From the 2026-10-22 grill.

- **Q1.** Full replacement of node-llama-cpp, on its own branch, merged when ready.
- **Q2.** The binaries are bundled in the installer.
- **Q3, Q5.** Follow LM Studio: a Unified KV Cache toggle, default on. Q5 was reopened on the evidence that a full unified pool fails every in-flight request, and the default stays on.
- **Q4, Q6.** Flash Attention stays a checkbox, default on, and off means off.
- **Q7.** K and V cache types are separate settings: F16, Q8_0, Q4_0.
- **Q8.** A feature-branch worktree. Ticket worktrees branch from it and land on it.
- **Q9.** Keep the load percentage bar. Reopened when single-model mode turned out to report no progress: run in router mode.
- **Q10.** Windows bundles Vulkan + CPU, as today.
- **Q11.** The switch ships K/V cache types, KV Cache in RAM, the Unified KV Cache toggle, and image input.
- **Q12.** Merge bar: the load matrix, the packaged-build smoke test, and the four gates. Parity probes are wanted, not blocking.
- **Q13.** Projectors are auto-detected beside the model, and catalog vision entries download theirs.
- **Q14.** Windows, macOS and Linux switch together.
- **Q15.** The changelog is the only notice.
- **Q16.** Images without a projector are dropped and counted in the header.
- **Q17.** A failed GPU load falls back to the CPU and shows it.
- **Q18.** A pinned build tag. The `release` skill checks for a newer build and bumps it.
- **Q19.** macOS and Linux are proven by CI only.
- **Q20.** Keep a thin proxy in front of `llama-server`.
- **Q21.** Accept the repetition-penalty change and measure it.
- **Q22.** Pass `response_format` and Extra Parameters through.
- **Q23.** A Context Overflow setting with LM Studio's three policies, default Truncate Middle.
- **Q25.** Stored Flash Attention "off" values stay, and now mean off.

From ticket intent questions.

- **T01.** Linux ships x64 Vulkan and CPU builds; macOS ships arm64 and x64; no Windows or Linux arm64. The pin is one literal tag.
- **T02-1.** The router loads models from a one-section `--models-preset` INI written per start (model name → absolute path), not `--models-dir`, so models in the external folder still load and nothing scans at boot. It runs `--offline` with an empty cache folder. Ticket 08 adds the projector to the same section.
- **T02-2.** Ticket 02 owns the `--list-devices` parser and moves the device picker and Auto's pick onto it. The raw Vulkan index probe and `GGML_VK_VISIBLE_DEVICES` go: `--device` is the one pinning scheme. Ticket 04 keeps the VRAM share, free-at-load, total and the attributed process.
- **T02-3.** GPU Layers Max and Custom pass `--fit off`, so fit never shrinks the player's Context Size, and a load that doesn't fit fails as today. Auto keeps fit on.
- **T02-4.** The CPU fallback reruns the same binary with `--device none -ngl 0` on Windows and macOS, and the bundled CPU build on Linux. After a fallback the backend reads `cpu`. When the CPU load fails too, the error shown is the GPU attempt's, restated in setting names.
- **T03-1.** The proxy copies the old engine's message rule exactly: the last message always goes up as a user turn, whatever its role.
- **T03-2.** The proxy flattens text parts into one string joined by a blank line, as today. A message that still holds an image after stripping keeps its parts array.
- **T03-3.** If the opening `<think>` tag is missing, the proxy restores it per request from the router's `/apply-template`: when the rendered prompt ends with an open think tag, the tag goes in front of the first content.
- **T04-1.** The engine always passes `-lv 4`, since the buffer-size and "MiB free" lines only print at that level, and reads them for every GPU Layers mode. Output is drained continuously and never kept whole.
- **T04-2.** The attributed process is the router's model instance, found once per load by a parent-process lookup. nvidia-smi never lists the router.
- **T04-3.** The share sums the model, KV, compute and output buffers on non-host devices, across every device the instance uses. A hybrid model's recurrent-state (`RS`) buffer counts with the KV. Free-at-load and total sum the devices the instance used. Host buffers are left out. On the CPU backend the share is null. Measured: 3024.75 MiB against a 3042 MiB nvidia-smi delta.
- **T04-4.** The "~" mark and the fallback order in the viewer stay as they are.
- **T06-1.** The V-type / Flash Attention rule blocks rather than changes another setting. With Flash Attention off, the quantized V options are disabled with a hint. With a quantized V cache, the Flash Attention box is disabled with a hint. Neither setting changes the other.
- **T06-2.** The main process coerces a stored or IPC value of quantized V with Flash Attention off to F16, so a stale value can't produce a failing load.
- **T06-3.** K and V types use the panel's existing select; KV Cache in RAM is a check row. Stored as `f16` / `q8_0` / `q4_0` (anything else reads as `f16`) and a boolean.
- **T07-1.** The fitted prompt leaves room for the request's `max_tokens` when it sets one: prompt ≤ slot context − `max_tokens`. The reserve is capped at half the slot, so the prompt always gets at least half, and an answer that reaches the context edge ends with `finish_reason: "length"` as today.
- **T07-2.** Rolling Window keeps the merged system prompt and drops the oldest user/assistant turns, so the world is never the first thing lost.
- **T07-3.** When the messages a policy must keep still don't fit, the proxy returns the same context-length stop as Stop at Limit.
- **T07-4.** The context-length stop is an HTTP 400 whose message uses the panel's names, says how far over the story is, and names Context Size and Context Overflow as the fix. The app shows it like any endpoint error.
- **T07-5.** Context Overflow applies to the next request with no reload, so it sits with the "next turn" settings and the reload diff ignores it. This overrides "they apply on reload" for this one row. Being live, it has no applied value in the engine status.
- **T08-1.** A model pairs with `mmproj-<model file name>` in its own folder. Failing that, a folder with exactly one model and exactly one `*mmproj*.gguf` pairs them. Otherwise the model has no projector. Catalog downloads save the projector under the exact name.
- **T08-2.** Projector files never show as models: not in Installed, the model picker, or the model list.
- **T08-3.** Catalog vision entries are only those whose own repo ships a projector (HauhauCS Gemma4 12B, Qwen3.6 35B-A3B Anko). No cross-repo projector for a finetune.
- **T08-4.** A model and its projector download as one job with one progress bar and shared pause and resume. A model already on disk fetches only its missing projector.
- **T08-5.** Deleting a model in the app's folder also deletes its exactly named projector, and nothing else.
- **T08-6.** A "Vision" badge, styled like the existing "Reasoning" badge, marks paired models in Installed and vision entries in Recommended.
- **T17.** `llama-server` runs with `--reasoning-format deepseek`, and the proxy passes `reasoning_content` through. The app reads it like any endpoint's separate reasoning field. This replaces T03-3 and the `--reasoning-format none` line: a Gemma 4 template's thought tags reached the narration under `none`.
- **T18.** A conversation with tool turns keeps its `tool_calls`, `tool` messages and `reasoning_content` through the proxy, and a trailing `tool` message stays a `tool` message. T03-1 and T03-2 still apply to conversations without tool turns. A tool conversation is one with an assistant message carrying `tool_calls`; inside it, system messages still merge, text still flattens, and unknown roles still drop. Context Overflow never splits an assistant `tool_calls` message from its `tool` replies and keeps the current tool round whole; a round that doesn't fit gives the T07-3 context stop.
- **T14.** `--cache-ram` stays at the server default (8192 MiB), as LM Studio leaves it. Ticket 14 is wontfix.
- **T16.** The share counts the output buffer too; T04-3 is amended to match the code. Ticket 16 adds the test. Every recorded output buffer is a host buffer, so it stays out of the share; only an on-device output buffer counts.

## Further Notes

- Constraint: no export-shape change. Worlds and saves don't change. The new settings are local app settings.
- Research for this spec: the agent review checked the server flags, slot math, request fields, defaults, release assets and LM Studio's schema against llama.cpp master and `lmstudio-js` on 2026-10-22. The VRAM review mapped every viewer source. The measured estimate bug: on Qwen3 4B at 8192 context, llama.cpp allocates 612 MiB of Q8_0 KV cache, and node-llama-cpp estimates about 19.6 GB.
- Watch the `--cache-ram` value and the server's 256-cell context padding when sizing Context Size × Parallel Requests.
