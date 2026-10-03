# 05: Settings modal and search switches

Status: done
Base: 68416c28
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The first slice a player can see: a gear in the Formaquestion header opens **Formaquestion Settings**, and the General tab changes how a question finds its docs sections.

**The modal (Q18, Q25, Q30, Q31).**

- A regular dialog with the size of the Settings modal and four tabs: General, Endpoint, Prompts, Tools. The three later tabs show nothing yet; their tickets fill them.
- The help window stays above the modal, as above every dialog.
- The mobile sheet has the same gear (Q22).
- The dialog and its tabs report to the surface registry, the surface label table names them, and the dev router has an entry.
- The Formaquestion docs page gains a section for the modal and one for each tab, so the coverage test passes. This ticket writes the General section; each tab's ticket writes its own.

**General tab.**

| Setting | Default | Ruling |
|---|---|---|
| Keyword Search | On | Q40 |
| AI Picks | On | Q6. The help line states the cost: one more request for each question |
| Use the Open Screen | On | Q42 |
| History Length | 4 | Q44 |

- Each setting is stored on the device and survives a reload. A bad stored value falls back to the default.
- Use the Open Screen off removes the screen section and the screen line from the request.

**The bare-question rule (Q41).** When no docs section reaches the model, the user message is the question alone, and the answer gets no general-knowledge flag. When a section reaches the model, the flag rules are as they are today.

Recommended model rationale: a new dialog, a stored settings layer and a rule change in the help session, with Playwright for the stacking.

## Acceptance criteria

- [ ] The gear opens the modal from the window and from the mobile sheet; the window stays usable above it (Playwright, static frames).
- [ ] Each General setting changes the request that leaves the app, and survives a remount.
- [ ] With every source off and Use the Open Screen off, the user message is the question alone and the answer shows no notice and no Nearest Sections.
- [ ] With the defaults, the request bodies equal those of ticket 04.
- [ ] A guard is proven: restore the old flag rule and confirm the bare-question test fails.
- [ ] The surface scan and the docs coverage test pass with the new Surface ids.
- [ ] Copy follows the writing guide; labels are in title case.
- [ ] A changelog line is in In Progress.
- [ ] The four gates are green.
