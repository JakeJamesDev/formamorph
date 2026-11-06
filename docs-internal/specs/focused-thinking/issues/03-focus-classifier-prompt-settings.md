# 03: Focus Classifier Prompt Settings

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: it follows the existing prompt-kind registration for the editor, samplers and endpoint routing.

## What to build

A player in Focused mode can read and tune the Focus Classifier like any other prompt (Q11).

- The Focus Classifier appears in the prompt editor, available only when the Thinking Mode is Focused, with reset to default.
- Its Options show the pinned temperature and repetition penalty, with custom overrides as other prompts have.
- Its endpoint is a per-prompt endpoint setting that defaults to the narration endpoint, so a player can route it to a cheaper endpoint.
- Every new screen state has a dev-route entry. Copy follows the Writing Guide.
- Player docs that list the prompts or the Thinking Modes mention the classifier.

## Acceptance criteria

- [ ] The prompt editor lists the Focus Classifier in Focused mode and hides it in the other modes.
- [ ] An edited classifier prompt is the one the next Focused turn sends, and reset restores the default.
- [ ] A custom temperature replaces the pin in the classifier request.
- [ ] With no endpoint picked, the classifier uses the narration endpoint; with one picked, it uses that one.
- [ ] Frame of the prompt editor tab at a desktop width in both themes: `.scratch/frames/focus-prompt-tab-light.png`, `.scratch/frames/focus-prompt-tab-dark.png`.
