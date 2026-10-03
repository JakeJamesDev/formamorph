# 21: Conversation

Status: done
Base: 15319e49
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

- [x] A follow-up request holds the earlier question and answer text and no earlier docs sections
- [x] With more exchanges than the cap, the oldest are left out of the request and stay visible in the window
- [x] A follow-up with no keywords of its own still retrieves sections for the topic
- [x] The conversation survives closing the window and a screen change, and is empty after a reload
- [x] A test proves nothing about the conversation is written to browser storage
- [x] Clear empties the conversation and cancels a running answer
- [x] During a turn, Send is unavailable with its reason, and search still works; after the turn, Send works
- [x] With an AI Language set, the request carries the directive; with none, it does not
- [x] Probe numbers with an in-batch control are in the handover
- [x] Changelog: folded into the Formaquestion In Progress entry
- [x] Four gates green

## Comments

**Built.** A player can ask a follow-up, clear the conversation, and keep it across a close and a screen change. Send waits while a game turn generates. Answers follow the AI Language.

| File | Role |
|---|---|
| `src/lib/formaquestion/helpSession.ts` | `HELP_HISTORY_EXCHANGES` (4), `EarlierExchange`, the history messages, and `helpSections(index, question, { history })`, the follow-up search |
| `src/lib/formaquestion/helpPrompt.ts` | `helpSystemPrompt(language)`: the directive and a keep-control-names line, only when the language is not English |
| `src/lib/languages.ts` | A third directive surface, `answers` |
| `src/lib/turnActivity.ts` | A small store: is a game turn generating? `GameplayContext` writes `isWaitingForAI` to it; the window reads it |
| `src/components/formaquestion/useHelpChat.ts` | Sends the exchanges, `clear`, `held` |
| `src/components/formaquestion/AskParts.tsx` | The **Clear** row, and the Send reason under the field (approved pattern 9) |
| `testing/baseline/harness/help-conversation-probe.cli.ts`, `testing/baseline/help-followup-cases.json` | The probe: follow-up retrieval, follow-up answers, AI Language |

**Picks made here.**

- 🔢 History cap: 4 exchanges. In the probe, the largest per-case average follow-up request was about 12,300 characters, well inside the endpoint's 10,750-token window.
- 🔎 Follow-up search: the question's own top hit first, then the search of the previous answered question and the follow-up together. The first build searched only the two together. The review found that after a change of topic it lost the new topic's section in 3 of 8 cases; this rule sends it, first, in 8 of 8.
- ✂️ A stopped or failed answer goes into the history with the text the player saw. Only an empty answer is left out.
- 🌐 The directive is `languageDirective('answers', …)`: "Write all answers in Spanish." It is the narration's function and wording template, with the help noun.
- 🧹 **Clear** sits in a row above the conversation, with the look of the **Back to Conversation** row. ⚠️ It needs your approval as a visual pattern: it is in Design-System.md, but not in the approved-pattern table.
- 🚦 While a turn generates, the player can still type a question; only Send waits. A help answer that started before the turn keeps running.

**Probe numbers.** Cloud default (`default`, Aphrodite, Gemma build), the app's own `askHelp`, pins and body, plus `reasoning_effort: "none"`.

*Follow-up retrieval* (exact, no model; 8 follow-ups, 8 topic changes):

| Check | Follow-up alone (control) | Shipped |
|---|---|---|
| Section the follow-up needs is sent | 1/8 | 4/8 |
| Topic section (the first question's top hit) is sent | 0/8 | 6/8 |
| Topic change: the new question's section is sent | 8/8 | 8/8, first in 8/8 |

The 4 misses are keyword gaps, not the follow-up rule: "put it back" never finds **Restore**, "change it later" never finds **Update a Listing**. Ticket 27 owns those.

*Follow-up answers* (8 cases × 5 runs; per run the first question is asked once, then both arms go out in the same batch):

| Arm | n | All keyed names | Declined |
|---|---|---|---|
| Shipped: history + follow-up search | 40 | 45% | 45% |
| Control: the follow-up alone | 40 | 0% | 65% |

With the right section sent, the shipped arm named every keyed control in 18 of 20 answers. An earlier batch on the first search rule gave 50% against 8%.

*AI Language* (the 8 docs-wording questions × 5 runs, three arms in one batch):

| Arm | n | In the language | All keyed names kept | Names in bold | Numbered steps |
|---|---|---|---|---|---|
| English (control, no directive) | 40 | 100% | 100% | 100% | 100% |
| Spanish | 40 | 100% | 100% | 100% | 100% |
| Japanese | 40 | 100% | 100% | 100% | 100% |

"In the language" counts common words (Spanish) or script share (Japanese) with the bold names left out. A spot check: the Spanish and Japanese LM Studio answers keep **Enable CORS**, **Endpoint URL** and **Model Name** in English.

**Guards bite.** 28 mutations, one at a time, each restored; every one fails a test. They cover the cap, empty answers, the search rule (combined only, own only, duplicates, the 5-section limit, the oldest question), the history messages, the directive (ignored, on English, no names line), Clear (no abort, run kept), the hold (hook, Send, the line, its place under the field), the publish and the reset in `GameplayContext`, a storage write, the language read, and trimmed exchanges. Three survived the first pass and each has a test now: Clear without resetting the run, the section limit with history, and the line's place.

**Playwright** (`e2e/formaquestion.spec.ts`): two new tests pass. A follow-up carries the first exchange, survives a change to the game screen, and a reload empties it. During a real game turn (the endpoint holds the turn open), Send is unavailable with its line and Search works; after the turn, Send works.

**Review fold-in.**

| Finding | Fix |
|---|---|
| The follow-up search lost the new topic after a change of topic (spec) | The question's own top hit goes first |
| No test for "the oldest stay visible in the window" (spec) | Hook test with 6 exchanges |
| Pattern 9 is "under the field"; the line was above it (standards) | Moved under the field; a test checks the order |
| Design-System.md still said pattern 9 was not built (standards) | Built, with a state row and the **Clear** label |
| `HelpTurn` reads as a game turn (standards) | Renamed `EarlierExchange` |
| A redundant ref and a copy of the exchanges in the hook | Removed |
| An `as unknown as` cast with no comment in a test | A typed spy instead |
| Two TSDoc lines out of date (`languages.ts`, `helpPrompt.ts`) | Rewritten |

Left as is: the probe copies `pool`, `pct` and the snapshot from `help-probe.cli.ts`. That file was ticket 22's open work; a shared harness module can come later.

**Gates.** typecheck 0, lint 0, build 0. `npm test`: 15,950 pass; 1 fail in ticket 22's `docsLookup.test.ts` while that session edited it, and it passes alone. The suite ran 128s.

**Not covered.**

| Item | State |
|---|---|
| A local model (Cydonia) | Not run. Cloud only, per the test-target policy; LM Studio is in use by ticket 22 |
| The keep-control-names line on its own | Not probed apart from the directive. Names were kept in 100% with both |
| A language the model writes poorly | Not probed |

