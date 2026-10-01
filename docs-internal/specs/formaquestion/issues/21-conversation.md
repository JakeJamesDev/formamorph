# 21: Conversation

Status: ready-for-agent
Blocked by: 20 — Ask a question
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A player can ask a follow-up, and the help chat behaves well beside a game in progress.

- **Follow-ups (Q5).** The request carries the last few exchanges, so "and then?" works. The cap is an exchange count in one named constant. Only the question and answer text of earlier exchanges is resent; the docs sections fetched for them are not.
- **Retrieval on a follow-up.** A short follow-up has few keywords. The search uses the follow-up together with the previous question, so the right sections still reach the model.
- **Kept until the app closes (Q6).** The conversation lives in memory at the app root. It survives closing the window and changing screens. A reload clears it. Nothing is written to storage.
- **Clear.** A control empties the conversation.
- **Held Send (Q16).** While a game turn generates, Send is unavailable and a short line says why. Docs search and the reader still work. The window reads the turn state; it does not join the Turn Pipeline.
- **AI Language (Q11).** The help prompt carries the same language directive that narration uses. The prompt tells the model to keep control names as written in the docs.

Report probe numbers for the language directive and for follow-up retrieval, with an in-batch control.

Recommended model rationale: several small behaviors over one seam; the follow-up retrieval rule needs care.

## Acceptance criteria

- [ ] A follow-up request holds the earlier question and answer text and no earlier docs sections
- [ ] With more exchanges than the cap, the oldest are left out of the request and stay visible in the window
- [ ] A follow-up with no keywords of its own still retrieves sections for the topic
- [ ] The conversation survives closing the window and a screen change, and is empty after a reload
- [ ] A test proves nothing about the conversation is written to browser storage
- [ ] Clear empties the conversation and cancels a running answer
- [ ] During a turn, Send is unavailable with its reason, and search still works; after the turn, Send works
- [ ] With an AI Language set, the request carries the directive; with none, it does not
- [ ] Probe numbers with an in-batch control are in the handover
- [ ] Changelog: folded into the Formaquestion In Progress entry
- [ ] Four gates green
