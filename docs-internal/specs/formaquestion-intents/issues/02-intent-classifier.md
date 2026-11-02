# 02: Intent Classifier

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a new prompt kind, a parallel request, and four Intent plans with a safe fallback.

## What to build

The **Intent Classifier** gives each Formaquestion question one **Intent** before the answer request, and the answer request carries that Intent's plan (ticket 01).

- A new help prompt kind with its own sampler pins, pinned explicitly. Its endpoint setting defaults to the pick endpoint (Q25).
- It reads the question, the last exchange and the Surface (Q22, Q47). It may give Chat, Help, Code, World or Create on every screen. It uses a strict schema with one enum field where the endpoint accepts schemas, and a prompted label that the app checks everywhere else. It also says whether the question holds a second ask of another Intent.
- It runs alongside the guide pick and the world pick (Q23). Chat drops both picks; World drops the guide pick.
- Plans: Chat, Help, Code and World per the spec's table (Q26, Q27, Q44, Q48). Code no longer comes from `isCodeTurn` or the open tab (Q24, Q47). World with no world open sends a rider that says so (Q49).
- A bad or missing label gets today's full request (Q20). **Until ticket 05 lands, Create also gets the full request.**
- The two-ask rider tells the Mascot the player asked for two things and she can handle one at a time for now (Q21).
- The chosen Intent and the classifier request show in the AI context viewer only (Q33).
- An **Intent Classifier** switch in Formaquestion's settings, default off until ticket 06 passes (Q32, Q43). Off sends no classifier request and today's full request.
- The help preset gains the Intent Classifier prompt. A preset file without it loads with the built-in default (Q58).
- CONTEXT.md gains **Intent Classifier** and **Intent**. The player docs describe the switch and its endpoint.

This ticket owns the Intent type. Tickets 03 and 05 build on it.

Spec: Q19–Q27, Q32, Q33, Q43, Q44, Q47–Q49, Q58, Q59, Q69; stories 1–15.

## Acceptance criteria

- [x] Each of Chat, Help, Code and World sends exactly its row of the spec's table: `askHelp` tests with a stubbed classifier reply: `helpSession.intent.test.ts` "the Intent plans"; Code equals the switch-off body of a code-word question
- [x] An unknown label, a parse failure, and Create (for now) send today's full request: "the fallback to the full request", each body equal to the switch-off body; a failed request too
- [x] An open Code tab with a Help label sends no code rider: "sends no code rider to a Help question from an open Code tab"
- [x] World with no world open sends no world block and the no-world rider: "sends World with no world open…"
- [x] A two-ask reply adds the rider to the answer request: "adds the two-ask rider last…", Help and Chat
- [x] The classifier request runs alongside the picks, and Chat sends no picks to the answer: request-order test: a held classifier reply sees both picks go out first and the answer wait; adding `await reading` before the search turned it red
- [x] With the switch off, no classifier request goes out and the body is byte-equal to ticket 01's: "does not go out with the switch off"; byte-equality by `helpSession.parity.test.ts` against ticket 01's captured bodies, unchanged and green
- [x] The schema path and the prompted-label path both reach the same plan: "sends the schema where the endpoint accepts one…"; a refused schema retries once without it
- [x] The AI context viewer shows the Intent and the classifier request: `Formaquestion.aiContext.test.tsx` "shows the sorted kind and the sorting request…"
- [x] A help preset file without the classifier prompt loads with the default; one with it round-trips: `helpPresetFile.test.ts`, and the stored store in `helpPresets.test.ts`
- [x] The CONTEXT.md entries and the player docs exist: **Intent** and **Intent Classifier** in CONTEXT.md; "How to Turn On Sort Questions" and the settings, prompt and AI Context rows in `docs/Formaquestion.md`

## Landed

**Not verified:**
- Nothing in the criteria. The live UI (the **Sort Questions** row, the **Sorting Endpoint** field, the **Sorting** prompt) was checked by component tests only, not in a preview.

**For you:**
- Ask a few small-talk, help, code and lore questions with the switch on, and judge whether the answers feel faster and stay as good (Formaquestion, World Editor and game).
- The labels: **Sort Questions**, **Sorting Endpoint**, the **Sorting** prompt and its **Sorting Format** chip, and **Sorted as** in AI Context (Formaquestion Settings → General, Endpoint, Prompts).

**For ticket 06:** the classifier prompt, the World message text (no `<guide>` block, grounded in "world sections") and the two riders have no probe numbers yet. World falls back to the full request whenever the Help plan carries no world (Read the World off, or every source off with no lead), not only with Read the World off.
