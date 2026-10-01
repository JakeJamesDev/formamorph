# 🎨 Image Generation

Formamorph can draw images with an image server that you connect. It makes portraits for entities, pictures for locations and world thumbnails, and an image of each turn. The image server is separate from your text AI. It can run on your own PC, or be a paid cloud service.

> Image generation is off until you turn it on. To connect a text AI, see [Connect Your Own AI](Connect-Your-Own-AI).

## How to Turn On Image Generation

1. Open **Settings**, then the **Endpoints** tab, then the **Image** tab.
2. Select the **Enable Image Generation** checkbox.
3. In **Provider**, select your image server.
4. Select **How to Set Up** and follow the steps for that provider. The steps for each provider are below too.
5. Fill in **Endpoint URL**, **API Token** and **Model** as the provider needs.

The **Generate with AI** buttons now show beside the World Editor's image fields. To get an image of each turn, see [How to Turn On Scene Images](#how-to-turn-on-scene-images).

## How to Connect ComfyUI

1. Install ComfyUI.
2. Add `--enable-cors-header` to the start command in your `run_*.bat` file.
3. Run that file to start ComfyUI.
4. In **Provider**, select **ComfyUI (local)**.
5. Leave **Endpoint URL** empty to use `http://localhost:8188`, or type your server's address.
6. In **Model**, select a checkpoint. The **Model** and **Sampler** lists load from your server.

To use your own ComfyUI graph, see [How to Use Your Own ComfyUI Workflow](#how-to-use-your-own-comfyui-workflow).

## How to Connect InvokeAI

1. Install InvokeAI.
2. Open `invokeai.yaml` in the InvokeAI root folder.
3. Add the app's address to `allow_origins`. **How to Set Up** shows the exact line for the app you use, for example `allow_origins: ["https://formamorph.ai"]`.
4. Restart InvokeAI.
5. In **Provider**, select **InvokeAI (local)**.
6. Leave **Endpoint URL** empty to use `http://localhost:9090`, or type your server's address.
7. In **Model**, select an installed SDXL, SD1.5, Z-Image or Anima model. The list loads from your server.

A Z-Image or Anima model also needs a Qwen3 text encoder and a VAE. Formamorph picks installed ones. To choose them yourself, see [InvokeAI Fields](#invokeai-fields).

## How to Connect Automatic1111 or Forge

1. Install Automatic1111 or Forge.
2. Add this line to `webui-user.bat`:

   ```
   set COMMANDLINE_ARGS=--api --cors-allow-origins=*
   ```

3. Run `webui-user.bat` to start the server.
4. In **Provider**, select **Automatic1111 / Forge (local)**.
5. Leave **Endpoint URL** empty to use `http://localhost:7860`, or type your server's address.
6. In **Model**, type the checkpoint name, or leave it empty to use the server's checkpoint.

To use **Face Fix**, install the **ADetailer** extension on your server.

## How to Connect NovelAI

You need a NovelAI subscription.

1. In NovelAI, select the cog icon, then the **Account** tab.
2. Select **Get Persistent API Token**. Copy the token before you close the popup. NovelAI shows it only once.
3. In Formamorph, in **Provider**, select **NovelAI (cloud)**.
4. Paste the token in **API Token**. **Endpoint URL** is already set to `https://image.novelai.net`.
5. In **Model**, select a NovelAI model.

NovelAI starts at 1024×1024 and 28 steps. **Opus** subscribers get one free image per request at those values or lower. Larger images or more steps spend Anlas. **Stop** can't cancel an image that NovelAI has started, so that image can still cost Anlas.

## How to Connect an OpenAI-Compatible Service

This provider works only in the [desktop app](Connect-Your-Own-AI). The desktop app sends the requests for you, so the service needs no CORS setup.

1. In **Provider**, select **OpenAI-compatible (cloud)**.
2. In **Endpoint URL**, type the service's base URL, for example `https://api.openai.com`.
3. Paste your API key in **API Token**. It stays on your PC.
4. In **Model**, type the image model name. Empty uses `gpt-image-1`.

This provider ignores **Negative Prompt**, **Steps / CFG** and **Sampler**. Each image is 1024×1024, 1536×1024 or 1024×1536, whichever shape is nearest to the size you set.

## How to Use Your Own ComfyUI Workflow

The **Workflow (API Format)** field shows in Advanced mode. It holds the ComfyUI graph that Formamorph sends. **How to Get This** shows these steps too.

1. In ComfyUI, open **Settings** and turn on **Enable dev mode options (API save, etc.)**.
2. Load or build your workflow.
3. Select **Workflow → Export (API)**. Older builds have a **Save (API Format)** button. You get a `.json` file.
4. Open the file and paste all of it in **Workflow (API Format)**.
5. Replace each value that Formamorph must set with its token. See [ComfyUI Workflow Rules](#comfyui-workflow-rules).

**Reset to Defaults** puts back the default graph.

## How to Turn On Scene Images

1. Turn on image generation. See [How to Turn On Image Generation](#how-to-turn-on-image-generation).
2. Open **Settings**, then the **Display** tab.
3. In the **Scene** section, select **Scene Images**.

Each turn now ends with an image. See [Scene Images](#scene-images).

## How to Make an Image of One Turn

1. In the game, open the turn's **More** menu.
2. Select **Generate Scene Image**. The item shows when the turn has no image.

If a turn is still running, the image starts when it ends. **Write Scene Tags** writes the tags only, so you can edit them before the image is made.

## How to Add an Image Preset

1. On the **Image** tab, open **Preset**.
2. Select **Add New Preset…**.
3. Type a name and select **Save**. The new preset copies the current values.
4. Change the values you want. They save to that preset.

Select a preset in **Preset** to switch to it. See [Image Presets](#image-presets).

## Providers

| Provider | Runs on | Default address | Setup |
|---|---|---|---|
| **ComfyUI (local)** | Your PC | `http://localhost:8188` | [How to Connect ComfyUI](#how-to-connect-comfyui) |
| **InvokeAI (local)** | Your PC | `http://localhost:9090` | [How to Connect InvokeAI](#how-to-connect-invokeai) |
| **Automatic1111 / Forge (local)** | Your PC | `http://localhost:7860` | [How to Connect Automatic1111 or Forge](#how-to-connect-automatic1111-or-forge) |
| **NovelAI (cloud)** | NovelAI's servers | `https://image.novelai.net` | [How to Connect NovelAI](#how-to-connect-novelai) |
| **OpenAI-compatible (cloud)** | The service you pick | None. Type one. | [How to Connect an OpenAI-Compatible Service](#how-to-connect-an-openai-compatible-service) |

**ComfyUI (local)** is the default provider. In the browser, **OpenAI-compatible (cloud)** shows *desktop app only* and can't be picked.

Each field of the **Image** tab is explained in [Settings → Image](Settings#image).

### InvokeAI Fields

These fields show in Advanced mode when the provider is **InvokeAI (local)**.

| Field | What it does |
|---|---|
| **Board** | The InvokeAI board that gets the images. **Uncategorized** is InvokeAI's own default. |
| **Qwen3 Encoder** | The text encoder for a Z-Image or Anima model. Z-Image needs Qwen3 4B; Anima needs Qwen3 0.6B. Empty picks one. |
| **Z-Image VAE**, **Anima VAE** | The VAE for that model. Z-Image needs a FLUX-type VAE. Anima needs a QwenImage/Wan 2.1 VAE; a FLUX VAE also works. Empty picks one. |

**Face Fix** on InvokeAI needs no extension. The first image with it on waits while InvokeAI downloads its detector models, a few hundred MB, one time. After that, it about doubles the time of each image.

## ComfyUI Workflow Rules

The workflow must be ComfyUI's API format, not the normal saved workflow. Formamorph puts its values in with these tokens:

| Value | Token |
|---|---|
| Positive prompt text | `"%prompt%"` |
| Negative prompt text | `"%negative%"` |
| Checkpoint (`ckpt_name`) | `"%ckpt%"` |
| Sampler (`sampler_name`) | `"%sampler%"` |
| Latent width and height | `%width%`, `%height%` |
| KSampler seed, steps and cfg | `%seed%`, `%steps%`, `%cfg%` |

- A text token goes inside the quotes: `"text": "%prompt%"`.
- A number token replaces the number: `"width": %width%`.
- A value with no token stays the same on each image. Use this to fix a LoRA, a refiner or a size.
- Formamorph takes the first image that any output node makes.
- An empty field uses the default graph.

When ComfyUI refuses the graph, the error names each node that failed and why. Text that is not JSON shows *Invalid ComfyUI workflow JSON*.

## Scene Images

With **Scene Images** on, each turn ends with an image of the scene. The image comes last, after all of the turn's text. Your next action waits for it.

The image is made in these steps:

1. Your text AI writes tags for the action in the turn. The **Scene Tags** prompt does this. See [Prompts](Prompts).
2. The game adds the **Image Tags** of the location and of up to two entities in the scene.
3. An entity or location with no **Image Tags** gets tags from its description, through the [Tag Prompt](Settings#tag-prompt).
4. The image server draws the tags at the **Landscape** size of the current preset.

The image shows on the turn, above your action. Select it to zoom. A turn can keep several images: use **Previous image** and **Next image** to move between them, and **Delete this image** to remove one.

The panel under the image shows the progress, with **Stop**. Select **Tags** to see the tag line:

| Control | What it does |
|---|---|
| **Re-roll tags** | Writes a new tag line from this turn |
| **Draw again** | Draws the same tags again. After you edit the tags, it is **Draw these tags**. |
| **Revert** | Puts back the tags you edited |

Scene images are not in a save unless you select their checkbox in **Save Game**. Without them, the save keeps the tags only. See [The Save Game Dialog](Saves-and-Backup#the-save-game-dialog). A rewind removes the images of the turns it removes.

## Image Presets

A preset keeps a full set of **Image** tab values: the provider, its address and token, the model, the prompts, the sizes and the sampling values. Keep one preset for each server or style, and switch between them.

| Control | What it does |
|---|---|
| **Preset** | Switches to a preset. **Add New Preset…** makes one. |
| **Rename** | Changes the preset's name |
| **Reset** | Sets the preset back to its default values |
| **Delete** | Deletes the preset. Shows when you have more than one. |

The first preset is **Default**, and you can edit it. The **Generate image** dialog in the World Editor has its own **Preset** picker. **Enable Image Generation** and the **Tag Prompt** are the same for all presets.

## One GPU for Text and Images

Most PCs have one graphics card. When a text model and an image model run on one card at the same time, both move into system memory and get very slow. So Formamorph never runs them at the same time:

- A scene image starts after the turn's text is complete.
- Your next action waits until the image is done.
- An image you ask for during a turn starts when the turn ends.
- A rewind or a re-generate stops the image in progress.

Each turn with **Scene Images** on takes as long as your image server needs.
