# 04: Connect Your Own AI Wiki Page

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/demo-ai/spec.md`

## What to build

A new wiki page, `Connect-Your-Own-AI`, that tells a player how to move from the Demo AI to a stronger
model. The dialog from ticket 02 links to this page by that exact name, so the file name is fixed.

The page opens with two or three sentences on what the Demo AI is and why the model matters. Then it gives
three routes:

| Section | Content |
|---|---|
| Run a local server | LM Studio and Ollama: install, load a model, enable CORS, paste the server address into Settings → Endpoints |
| Use a hosted API service | Generic steps: an OpenAI-compatible chat-completions URL and an API token. No service names |
| Use the desktop app | The AI engine is built in, so there is nothing extra to install. The model you can run depends on your hardware |

Model advice goes on the page once: a model tuned for roleplay or conversation, 12B or larger as a rough
guide, the largest that your hardware runs well. No model names.

The page has no troubleshooting section. The in-app "can't reach your AI server" checklist keeps that job.

Write the page directly. Do not pass the prose to a smaller model. Check each LM Studio and Ollama step
against the tool's current documentation, and check the in-app labels against the app, before the page
states them.

## Acceptance criteria

- [ ] The page exists in the wiki source under the file name `Connect-Your-Own-AI`, and the sidebar and Home link to it.
- [ ] The three route sections exist with the content in the table. The hosted section names no service. The page names no model.
- [ ] The model advice appears once, with the 12B rough guide.
- [ ] The desktop section states the hardware caveat. It does not say or imply that the desktop app removes hardware limits.
- [ ] Each LM Studio and Ollama step is checked against a live source, and the response lists the sources.
- [ ] Setting names and tab names on the page match the app's current labels.
- [ ] The page is human-readable: short sections, tables or callouts over long prose, no version number, no reference to agent-only files.
- [ ] The page uses "Demo AI" for the hosted endpoint and never alternates with "default", "shared", "cloud", or "free" endpoint.
- [ ] Home and the Android install page say "Demo AI" where they name the default or cloud endpoint today.
- [ ] Released changelog sections do not change.
- [ ] Four gates green.
