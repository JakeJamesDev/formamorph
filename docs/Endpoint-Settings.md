# 🔌 Endpoint Settings
<!-- keywords: temperature, samplers, creativity, response length, cut off, context size, gpu layers, out of memory, api key, repetitive text -->
<!-- route: settings.endpoints -->

The **Endpoints** tab in Settings sets which AI the app connects to. It has its own tabs: **Text**, **Image** and, in Advanced mode, **Tag Prompt**.

- To set up a text endpoint step by step, follow [Connect Your Own AI](Connect-Your-Own-AI).
- To set up an image server, follow [Image Generation](Image-Generation).

In the tables below, **Advanced** marks a row that shows in Advanced mode only. See [Simple and Advanced](Settings#simple-and-advanced).

## Text
<!-- route: settingsEndpoints.text -->

The **Preset** list holds your saved endpoints:

- **Demo AI** is the shared cloud endpoint. You can't edit it.
- **Formamorph AI** is the preset for Patreon Supporters. It shows your allowance in place of the fields. See [Formamorph AI for Supporters](Connect-Your-Own-AI#formamorph-ai-for-supporters).
- On the desktop app, **Built-In Engine** runs a model on your PC.

**Add New Preset…** makes a new preset. **Duplicate** copies **Demo AI** or a preset you made. **Rename**, **Reset** and **Delete** act on a preset you made.

| Setting | What it does |
|---|---|
| **Endpoint URL** | The address of your model server. When the app completes the address, the line under it shows the full URL that requests go to. **Trouble Connecting?** opens a checklist. |
| **API Token** | The token for a hosted service. Leave it empty for a local server. |
| **Model Name** | The model the endpoint uses, exactly as the server names it |
| **Context Window** | **Advanced.** How many tokens the model keeps in context. **Detect** asks the server. |
| **Max Output Tokens** | **Advanced.** Caps how long each answer can be. It does not cap reasoning. To set it, select **Override Endpoint Limit**. Without it, the cap is **No Limit**. |
| **Sampling** | **Advanced.** Five rows: **Temperature**, **Repetition Penalty**, **Top-p**, **Top-k** and **Min-p**. Each row has a checkbox, and an unchecked row sends nothing. For **Temperature** and **Repetition Penalty**, a prompt's own value and a built-in prompt's value win over this row. |
| **Extra Parameters** | **Advanced.** A JSON object added to every request to this endpoint, such as a vendor's reasoning switch, `top_a`, `chat_template_kwargs` or a routing block. See [Extra Parameters](#extra-parameters). |

**Reset AI Endpoint**, at the bottom of the tab, sets the URL, model name, token and limits back to their defaults. It also clears **Extra Parameters**.

### Extra Parameters

- These fields only add what the app leaves out. A field the app sets for a request wins over the same field here.
- You can't set `model`, `messages`, `stream`, `tools`, `tool_choice`, `response_format`, `n` or `stop`.
- Text with an error shows why in red. Requests then go out without these fields.
- Where the app sends a reasoning field, the **Native Reasoning** row and each prompt's own setting control it. See [Reasoning](Settings#reasoning).

## Built-In Engine

On the desktop app, the **Built-In Engine** preset shows the engine's own panel in place of the fields. The panel has its own **Simple** and **Advanced** switch. Every row below **Local Model** is in the **Engine** section. See [The Desktop Engine](Connect-Your-Own-AI#the-desktop-engine).

| Setting | What it does |
|---|---|
| **Local Model** | **Manage Models…** opens the **Local model** dialog to download and load a model. Its **Options** view holds **Auto-Load**, on by default, which loads a model as soon as the engine is in use. |
| **Context Size** | How much recent story the model can see. More context uses more GPU memory. Lower it first when a model does not fit. |
| **GPU** | **Simple** on the panel. Runs the model on the GPU. Off runs it on the CPU, which is slower. |
| **GPU Layers**, **Layers** | **Advanced** on the panel. **Auto** puts as many layers on the GPU as fit. **Max** puts all of them there and can run out of memory. **Custom** sets the count in **Layers**. |
| **GPU Device** | Which GPU loads the model. Shows while the GPU is in use. See the list below. |
| **Temperature** | How much randomness the model uses when it picks each word. About 0.7 fits most story models. |
| **Max Output Tokens** | Caps how long each answer can be. An answer at the cap ends at its last full sentence. |
| **Top-p**, **Top-k**, **Min-p**, **Repetition Penalty** | **Advanced** on the panel. Sampling limits on which words the model picks. |

**GPU Device** has these choices:

- **Auto** uses your discrete GPU. With more than one, it uses all of them. With none, it uses the integrated GPU.
- **All GPUs** always splits a model across every GPU.
- A GPU by name uses only that GPU.

When you change the panel:

- Sampling changes apply on the next turn.
- The other changes need **Save & Reload Model**.
- **Reset to Defaults** sets the panel back.

## Engine Memory and Context
<!-- keywords: flash attention off, kv cache, kv cache in ram, offload kv to cpu, ram instead of vram, quantize cache, q8_0, q4_0, parallel requests, unified kv, longer context fits, story too long -->

These rows are on the [Built-In Engine](#built-in-engine) panel. They show when the panel's own switch is on **Advanced**.

| Setting | What it does |
|---|---|
| **Parallel Requests** | How many requests the model answers at the same time. With **Unified KV Cache** on, they share one context. With it off, each gets the full **Context Size** and uses more GPU memory. |
| **Unified KV Cache** | On by default. Parallel requests share one context, so extra requests add no GPU memory. A long request leaves less room for the others. Turn it off to give each request the full **Context Size**. |
| **K Cache Type**, **V Cache Type** | **F16** is full precision. **Q8_0** and **Q4_0** shrink the context, so a longer **Context Size** fits, at a small cost in quality. A quantized **V Cache Type** needs **Flash Attention**. While **Flash Attention** is off, **V Cache Type** can't be **Q8_0** or **Q4_0**. |
| **KV Cache in RAM** | Keeps the context in system RAM to free GPU memory. Replies get much slower, and the slowdown grows as the context fills. Try a smaller **K Cache Type** and **V Cache Type** first. Use this only when the model still does not fit. |

## Flash Attention
<!-- keywords: flash attention, turn flash attention off, old gpu, quantized v cache needs flash attention, fa -->

**Flash Attention** is **Advanced** on the panel, and on by default. It uses less GPU memory and is often faster. Turn it off when an old GPU can't run it. A quantized **V Cache Type** needs it on.

## Context Overflow
<!-- keywords: context overflow, story longer than context, truncate middle, rolling window, stop at limit, context length error, too long -->

**Context Overflow** is **Advanced** on the panel. It sets what happens when the story is longer than **Context Size**:

- **Truncate Middle** (default) keeps the system prompt and your first message, and drops messages from the middle.
- **Rolling Window** keeps the system prompt and drops the oldest messages first.
- **Stop at Limit** stops the request with an error.

It never cuts a message in half. A change applies on the next turn, with no reload.

## Image
<!-- route: settingsEndpoints.image -->

| Setting | What it does |
|---|---|
| **Preset** | Your saved image endpoints. You can edit each one, **Default** too. |
| **Enable Image Generation** | On by default. Shows the **Generate with AI** buttons. Off hides the other rows of this tab, the **Tag Prompt** tab and **Scene Images**. |

The **Connection** section sets which server makes the images. The setup steps for each provider are in [Image Generation](Image-Generation).

| Setting | What it does |
|---|---|
| **Provider** | ComfyUI, InvokeAI, Automatic1111 / Forge, NovelAI, or an OpenAI-compatible service on the desktop app. **How to Set Up** shows the steps for the picked provider. |
| **Endpoint URL**, **API Token** | The image server address and its token |
| **Model** | The checkpoint that makes the image. On ComfyUI it fills the workflow's `%ckpt%`. A workflow without `%ckpt%` loads its own model, and the row shows that model, grayed out. |

The **Image** section sets how each image is made.

| Setting | What it does |
|---|---|
| **Prompt Prefix** | Quality and style tags put before every image prompt |
| **Negative Prompt** | Tags the image must not have |
| **Clean Up Tags** | On by default. Rewrites scene and generated tags as plain lowercase words, without weights or other prompt syntax. Turn it off to send your entity and location tags as you wrote them. It never changes **Prompt Prefix** or **Negative Prompt**. |
| **Portrait Size**, **Landscape Size** | **Advanced.** Image width and height. Portraits are for entities. Landscapes are for locations and thumbnails. |
| **Steps / CFG** | Sampling steps, and how closely the image follows the prompt |
| **Sampler** | The sampling method |
| **Face Fix** | Automatic1111 / Forge and InvokeAI only. Draws faces again in a second pass. On Automatic1111 / Forge it needs the **ADetailer** extension on your server. On InvokeAI it about doubles the time. |
| **Workflow** | **Advanced**, ComfyUI only. Replaces the default ComfyUI graph with one exported in API format. **How to Get This** shows how to export one. **Reset to Defaults** brings back the default graph. |
| **File Name** | **Advanced**, ComfyUI only. Where each image is saved under ComfyUI's `output` folder. See [File Name](#file-name). |
| **Board** | **Advanced**, InvokeAI only. The InvokeAI board that gets the images |
| **Qwen3 Encoder**, **Z-Image VAE**, **Anima VAE** | **Advanced**, InvokeAI only. Shows for a Z-Image or Anima model. Leave them empty to pick one automatically. |

### File Name

- The pattern takes `{world}`, `{subject}`, `{turn}` and `{preset}`. `{subject}` is an entity's or location's name, or `turn-12-scene`.
- The default is `formamorph/{world}/{subject}`.
- A `/` in the pattern makes a folder.
- A custom workflow uses it where its save node's prefix is `%prefix%`. Without one, the row is grayed out.

## Tag Prompt
<!-- route: settingsEndpoints.tagPrompt -->

**Advanced.** Shows when **Enable Image Generation** is on. It is the prompt that your text model gets to turn a description into image tags. **Reset to Defaults** brings back the original text.
