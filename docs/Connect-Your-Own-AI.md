# 🔌 Connect Your Own AI
<!-- keywords: switch model, better writing quality, smarter narrator, llm backend, change provider, improve story quality, dumb replies, replace the demo -->

In the browser and on Android, Formamorph starts on the **Demo AI**. It is a small free model, and it is there so you can try the app with no setup. The desktop app starts on its **Built-In Engine** instead.

The AI writes everything you read. A stronger model gives you sharper narration, a better memory of your story, and entities that act the same from turn to turn. Nothing else changes the experience as much.

Every route ends in the same place: Settings → **Endpoints** → **Text**. The **Endpoints** tab shows in Simple and Advanced mode.

## How to Connect LM Studio
<!-- keywords: local model, own model, set up, hook up, link, use, run locally, offline, localhost, cors, gguf, lmstudio, port 1234, developer tab server, failed to fetch, connection refused, browser blocks request, self hosted llm -->
<!-- route: settingsEndpoints.text#text-preset -->

1. Download LM Studio from [lmstudio.ai](https://lmstudio.ai) and install it.
2. Open the **Discover** tab and download a model.
3. Open the **Developer** tab.
4. In the server settings, turn on **Enable CORS**. Your browser blocks the connection without it.
5. Turn on the **Start server** switch.
6. Load your model with the model loader. The **Developer** tab shows the server address, such as `http://localhost:1234`.
7. In Formamorph, open Settings → **Endpoints** → **Text**.
8. In the **Preset** list, select **Add New Preset…**.
9. Type a name in **New Preset**.
10. Select **Save**.
11. Paste the server address into **Endpoint URL**.
12. Leave **API Token** empty.
13. Type the model identifier that LM Studio shows into **Model Name**.

## How to Connect Ollama
<!-- keywords: local model, own model, set up, hook up, link, use, run locally, offline, localhost, cors, port 11434, pull a model, ollama serve, 403 forbidden -->
<!-- route: settingsEndpoints.text#text-preset -->

1. Download Ollama from [ollama.com/download](https://ollama.com/download) and install it.
2. Download a model: `ollama pull <model>`. Use a model name from the Ollama library.
3. Set the environment variable `OLLAMA_ORIGINS` to `*`. Your browser blocks the connection without it. See [OLLAMA_ORIGINS on Each System](#ollama_origins-on-each-system).
4. In Formamorph, open Settings → **Endpoints** → **Text**.
5. In the **Preset** list, select **Add New Preset…**.
6. Type a name in **New Preset**.
7. Select **Save**.
8. Type `http://localhost:11434` into **Endpoint URL**.
9. Leave **API Token** empty.
10. Type the model's name into **Model Name**, exactly as `ollama ls` lists it.

## How to Connect a Hosted API
<!-- keywords: openrouter, openai, key, cloud, paid service, provider, gpt, deepseek, set up, own key, endpoint, chatgpt, claude, gemini, anthropic, groq, mistral, subscription, remote server, byok, pay per token -->
<!-- route: settingsEndpoints.text#text-preset -->

1. Make an account with a service that offers an **OpenAI-compatible chat-completions** endpoint.
2. Get an API token from the service. Some services call it an API key.
3. Open Settings → **Endpoints** → **Text**.
4. In the **Preset** list, select **Add New Preset…**.
5. Type a name in **New Preset**.
6. Select **Save**.
7. Paste the service's chat-completions URL into **Endpoint URL**. It usually ends in `/v1/chat/completions`.
8. Paste your token into **API Token**.
9. Type the identifier of the model you want into **Model Name**.

## How to Use the Desktop Engine
<!-- keywords: built-in, offline, local model, download model, gpu, vram, run locally, no internet, own pc, windows app, standalone, graphics card, easiest setup, bundled llm, pc version, native app, without lm studio -->
<!-- route: settingsEndpoints.text -->

1. Get the desktop app from [formamorph.ai](https://formamorph.ai) and install it.
2. Open Settings → **Endpoints** → **Text**.
3. In the **Preset** list, select **Built-In Engine**.
4. Select **Manage Models…**. The **Local model** dialog opens.
5. Open **Recommended**. It groups models by the GPU memory they need, and starts on the group for your GPU.
6. Select **Download** on a model.

With **Auto-Load** on, the default, the model loads when its download finishes. With it off, select **Load** on the model.

## How to Play Against Your PC from Another Device
<!-- keywords: phone, tablet, laptop, network, wifi, lan, remote, mobile, home server, connect, ip address, same router, second computer, ipad, steam deck, tailscale, port forwarding, host elsewhere, private network blocked -->
<!-- route: settingsEndpoints.text#endpoint-url -->

1. Make your server accept connections from your network. In LM Studio, turn on **Serve on Local Network**. In Ollama, set `OLLAMA_HOST` to `0.0.0.0:11434`.
2. On the other device, open Settings → **Endpoints** → **Text**.
3. Type your PC's network address into **Endpoint URL**, such as `http://192.168.…:1234`.

In the browser, Chrome may block a public page from reaching your own network. The [Android app](Install-on-Android#-a-model-on-your-own-network) has no such block.

---

## 🧭 Pick a Route
<!-- keywords: which option, compare methods, weak hardware, no graphics card, easiest way, what do i need, pros and cons -->

| Route | You need | Best when |
|---|---|---|
| 🖥️ **Run a local server** | A PC with a capable GPU, plus LM Studio or Ollama | You want to play in the browser or on mobile, with the model on your own PC |
| ☁️ **Use a hosted API service** | An account with a service, and its API token | Your hardware can't run a good model |
| 📦 **Use the desktop app** | A PC with a capable GPU | You want the fewest installs |

## 🎯 Which Model to Pick
<!-- keywords: best llm, recommendation, roleplay finetune, parameter count, how big, good for rp, uncensored, suggested llms -->

- Pick a model tuned for **roleplay or conversation**.
- As a rough guide, use **12B parameters or larger**.
- Past that, use the largest model that your hardware runs well. A model that does not fit in your GPU's memory runs slowly.

## The Text Endpoint Fields
<!-- keywords: base url, server address format, api key box, v1 path, koboldcpp, llama.cpp, oobabooga, connection failed, unable to connect, checklist -->

| Field | What goes in it |
|---|---|
| **Preset** | The saved endpoint you use. **Add New Preset…** makes a new one. |
| **Endpoint URL** | The server address. A bare address such as `http://localhost:1234`, or one that ends in `/v1`, gets `/v1/chat/completions` added. The line under the field shows the full URL. Any other path stays as you typed it. |
| **API Token** | The service's token. Leave it empty for a local server. |
| **Model Name** | The model identifier, exactly as the server shows it. |

> 💡 If the connection fails, select **Trouble Connecting?** under **Endpoint URL**. It opens a checklist of the usual causes.

## OLLAMA_ORIGINS on Each System
<!-- keywords: environment variable, env var, launchctl, systemctl, cors error, allow browser origin, mac terminal, linux service -->

How you set the variable depends on your system:

| System | How |
|---|---|
| Windows | Quit Ollama, edit the environment variables for your account, add `OLLAMA_ORIGINS`, then start Ollama again |
| macOS | Run `launchctl setenv OLLAMA_ORIGINS "*"`, then restart the Ollama app |
| Linux | Run `systemctl edit ollama.service`, add `Environment="OLLAMA_ORIGINS=*"` under `[Service]`, then run `systemctl daemon-reload` and `systemctl restart ollama` |

## The Desktop Engine
<!-- keywords: installed models list, vram tiers, 8gb card, fits my gpu, embedded runtime, model manager, no separate server, browser has none -->

The desktop app has the AI engine built in, so there is nothing extra to install.

> ⚠️ **The model still runs on your hardware.** The desktop app removes the separate server install. It does not change which models your PC can run. That depends on your GPU and its memory.

The **Local model** dialog has three views: **Installed**, **Recommended** and **Options**. **Recommended** groups models as **≤4 GB**, **≤8 GB**, **≤16 GB** and **No Limit**.

The desktop app also connects to a local server or a hosted service. The steps are the same as above. The browser and Android builds have no **Built-In Engine**.

## The Set Up Your AI Dialog
<!-- keywords: first launch popup, no model found, ai unreachable, onboarding, wizard, detected hardware, model too big, start playing button, skip for now -->
<!-- route: aiSetup -->

On the desktop app, a **Set up your AI** dialog opens when the engine has no model to run. It also opens when you enter a world and the AI can't be reached.

| Part | What it does |
|---|---|
| Detected line | Shows your GPU, its memory and its class |
| Recommended model | One model that fits your GPU, with a download button |
| **Show all models** | Lists every model under **Best for Your GPU**, **Also Fits** and **Too Big for Your GPU** |
| **Open Settings** | Opens Settings → **Endpoints**, to use a server or a service instead |
| **Later** | Closes the dialog. You can set this up any time in Settings → **Endpoints**. |

When the model is ready, the title reads **You're ready**, and **Start Playing** closes it. For a custom endpoint that fails, **Try again** checks it again.
