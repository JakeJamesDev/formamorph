# 02: Intent Classifier

Status: ready-for-agent
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

- [ ] Each of Chat, Help, Code and World sends exactly its row of the spec's table: `askHelp` tests with a stubbed classifier reply
- [ ] An unknown label, a parse failure, and Create (for now) send today's full request
- [ ] An open Code tab with a Help label sends no code rider
- [ ] World with no world open sends no world block and the no-world rider
- [ ] A two-ask reply adds the rider to the answer request
- [ ] The classifier request runs alongside the picks, and Chat sends no picks to the answer: request-order test
- [ ] With the switch off, no classifier request goes out and the body is byte-equal to ticket 01's
- [ ] The schema path and the prompted-label path both reach the same plan
- [ ] The AI context viewer shows the Intent and the classifier request
- [ ] A help preset file without the classifier prompt loads with the default; one with it round-trips
- [ ] The CONTEXT.md entries and the player docs exist

For you: ask a few small-talk, help, code and lore questions with the switch on, and judge whether the answers feel faster and stay as good (Formaquestion, World Editor and game).
