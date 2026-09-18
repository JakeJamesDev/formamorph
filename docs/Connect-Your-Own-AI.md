# 🔌 Connect Your Own AI

Formamorph starts on the **Demo AI**. It is a small free model, and it is there so you can try the app with no setup.

The AI writes everything you read. A stronger model gives you sharper narration, a better memory of your story, and characters who stay in character. Nothing else changes the experience as much.

---

## 🧭 Pick a Route

| Route | You need | Best when |
|---|---|---|
| 🖥️ **Run a local server** | A PC with a capable GPU, plus LM Studio or Ollama | You want to play in the browser or on mobile, with the model on your own PC |
| ☁️ **Use a hosted API service** | An account with a service, and its API token | Your hardware can't run a good model |
| 📦 **Use the desktop app** | A PC with a capable GPU | You want the fewest installs |

Every route ends in the same place: **Settings → Endpoints → Text**.

---

## 🎯 Which Model to Pick

- Pick a model tuned for **roleplay or conversation**.
- As a rough guide, use **12B parameters or larger**.
- Past that, use the largest model that your hardware runs well. A model that does not fit in your GPU's memory runs slowly.

---

## 🖥️ Run a Local Server

A local server runs the model on your own PC. Formamorph connects to it like any other endpoint.

### LM Studio

1. Download LM Studio from [lmstudio.ai](https://lmstudio.ai) and install it.
2. Open the **Discover** tab and download a model.
3. Open the **Developer** tab.
4. In the server settings, turn on **Enable CORS**. Your browser blocks the connection without it.
5. Turn on the **Start server** switch.
6. Load your model with the model loader.

The **Developer** tab shows the server address. It is `http://localhost:1234` when **Server Port** is `1234`.

### Ollama

1. Download Ollama from [ollama.com/download](https://ollama.com/download) and install it.
2. Download a model: `ollama pull <model>`. Use a model name from the Ollama library.
3. Set the environment variable `OLLAMA_ORIGINS` to `*`. Your browser blocks the connection without it.

The server address is `http://localhost:11434`.

How to set the variable depends on your system:

| System | How |
|---|---|
| Windows | Quit Ollama, edit the environment variables for your account, add `OLLAMA_ORIGINS`, then start Ollama again |
| macOS | Run `launchctl setenv OLLAMA_ORIGINS "*"`, then restart the Ollama app |
| Linux | Run `systemctl edit ollama.service`, add `Environment="OLLAMA_ORIGINS=*"` under `[Service]`, then run `systemctl daemon-reload` and `systemctl restart ollama` |

### Connect Formamorph to the Server

1. Open **Settings → Endpoints → Text**.
2. In the **Preset** list, select **Add New Preset…** and name the preset.
3. Paste the server address into **Endpoint URL**. Formamorph completes the rest of the path.
4. Leave **API Token** empty.
5. Type the model's name into **Model Name**, exactly as your server shows it. LM Studio calls it the model identifier. In Ollama, `ollama ls` lists the names.

> 📱 **To play on another device**, such as the [Android app](Install-on-Android), the server must accept connections from your network. In LM Studio, turn on **Serve on Local Network**. In Ollama, set `OLLAMA_HOST` to `0.0.0.0:11434`. Then use your PC's network address, such as `http://192.168.…:1234`, in **Endpoint URL**.

> 💡 If the connection fails, select **Trouble Connecting?** under **Endpoint URL**. It gives a checklist of the usual causes.

---

## ☁️ Use a Hosted API Service

A hosted API service runs the model for you, so your own hardware does not matter.

Formamorph works with any service that offers an **OpenAI-compatible chat-completions** endpoint. You need three things from the service:

| From the service | Goes into |
|---|---|
| Its chat-completions URL, which usually ends in `/v1/chat/completions` | **Endpoint URL** |
| Your API token, which some services call an API key | **API Token** |
| The identifier of the model you want | **Model Name** |

1. Open **Settings → Endpoints → Text**.
2. In the **Preset** list, select **Add New Preset…** and name the preset.
3. Fill in the three fields from the table.

---

## 📦 Use the Desktop App

The desktop app has the AI engine built in, so there is nothing extra to install. Get it from [formamorph.ai](https://formamorph.ai).

1. Open **Settings → Endpoints → Text**.
2. In the **Preset** list, select **Built-In Engine**.
3. Select **Manage Models…**.
4. Open the **Recommended** tab. It groups models by the GPU memory they need.
5. Download a model.
6. Load the model.

> ⚠️ **The model still runs on your hardware.** The desktop app removes the separate server install. It does not change which models your PC can run. The model you can run depends on your GPU and its memory.

The desktop app also connects to a local server or a hosted service. The steps are the same as above.
