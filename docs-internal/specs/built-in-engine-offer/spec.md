# Spec: Built-In Engine Offer

Status: done
Status note: Follow-up tickets 05 and 06 (Q15–Q17) landed after the close as 381eaa504 and FormamorphServer b17f9ea, with no review or full gates after them. Closed 2026-11-09. Tickets 01–04, last landing fee78fb1b. Review: three gaps fixed by ticket 04, spec text corrected. Closed red: lint has 11 errors, all in the ignored worlds-wip folder and none in this effort; test exit 0 on 2026-11-09.
Spec session: built-in-engine-offer — spec

A desktop player who runs narration on the built-in engine with little VRAM learns about Formamorph AI a second time, after 10 turns of their own play. AMD, Intel and CPU-only machines join the low-VRAM group for the first time. Spans both repos: the client and FormamorphServer.

## Problem Statement

A low-VRAM desktop player sees Formamorph AI once, in AI setup, before any story exists. They have nothing to compare it with, so most pick the free download. After that the app never mentions it again. The story card only shows on the Demo AI.

A player with an AMD or Intel GPU, or with no GPU, never sees the offer at all. AI setup reads VRAM from `nvidia-smi` only, so their VRAM is unknown and the low-VRAM lead stays hidden.

We also cannot tell which offer leads to a pledge. The funnel counts one "offer shown" step with no source.

## Solution

**The card.** After 10 completed turns with narration on the built-in engine, a low-VRAM player sees a story card once. It sits where the Demo AI card sits: under the latest narration, above the choices, in the Chat and Pages layouts. Its copy compares Formamorph AI with the model on the player's own machine. **Not Now** hides it. **See Levels** opens The Road.

**Low VRAM for every vendor.** The app reads the device the built-in engine uses. A discrete card with a total up to 8,500 MB is low. An integrated GPU is low. A machine with no GPU is low. The AI setup lead and the new card both use this one answer.

**The count.** The card sends its own funnel step, so the Usage report shows the two cards apart.

## Rulings

| Q | Ruling |
|---|---|
| Q1 | The card goes to players whose narration runs on the built-in engine on a low-VRAM machine. No other local or remote endpoint gets it. |
| Q2 | The trigger is a count of player turns. No speed or regenerate signal. |
| Q3 | The card has its own seen record. A player can see the Demo AI card and this card, once each per install. |
| Q4 | This effort also fixes the AI setup lead for AMD, Intel and CPU-only machines. |
| Q5 | The card shows after 10 completed turns. |
| Q6 | Low VRAM is a reported total up to 8,500 MB, the same limit as the AI setup lead (First-Time Flow Q4). |
| Q7 | An integrated GPU counts as low VRAM. A CPU-only machine counts as low VRAM. |
| Q8 | The card has its own copy with the local comparison (First-Time Flow Q55). The user approves the words. |
| Q9 | The count has its own per-install counter and follows First-Time Flow Q31: a counted turn follows a player action, with narration on the built-in engine. The opening, a regenerate and a loaded save never count. Demo AI turns never count. |
| Q10 | Existing players start at zero and see the card once, after their next 10 turns. |
| Q11 | The card sends its own funnel step. |
| Q12 | Every integrated GPU counts as low. Strong APUs get no exception. |
| Q13 | Tests use four existing seams and add none (see Testing Decisions). |
| Q14 | The user approved both texts as landed, on 2026-11-09. Lead body: "Formamorph AI writes better narration and keeps characters more consistent than the models that fit your machine. Your support also helps fund new updates." Card: "Want a Bigger Model for This Story?" / "Your computer runs a small model that fits its memory. Formamorph AI runs a larger one on our servers, for sharper narration and characters who stay consistent. Your support includes it, and it helps fund new updates." |
| Q15 | Replaces the Q14 texts. Lead body: "your machine" becomes "your computer". Card body: "Your computer runs a small model that fits its memory. Formamorph AI runs a larger one without turning your computer into a space heater, for sharper narration and characters who stay consistent. Your support includes it, and it helps fund new updates." The user chose the comedic line. "characters" stays. |
| Q16 | The funnel step is named `engine_offer_shown`. `local_offer_shown` never shipped and gets no alias. |
| Q17 | Four cleanups from the close review are done in ticket 05: one shape for both cards' facts, `useStoryCard` renamed `useDemoAIStoryCard`, one device list in the engine listing, and a test seam for the VRAM class ask. The shared facts shape may rename fields; every test case and expectation stays, and each card keeps its own counter and seen record. |

**Carried over from First-Time Flow, unchanged:** no offer for a pledged player (Q44, Q66), in a build without hosted AI, or on Steam (Q6). The card uses Morphie (Q20), the Pages placement (Q19), and the lifetime of Q42: the seen record is written when the card first renders after the turn's reveal ends, and nothing brings the card back.

**Changed in First-Time Flow:** its "Who never sees it" line names "a player on a non-Demo endpoint". The built-in engine on a low-VRAM machine is now the one exception. A player on their own endpoint still gets no offer (user story 18 there).

## User Stories

1. As a low-VRAM player on the built-in engine, I want to hear about Formamorph AI after I have played, so that I can judge it against narration I have seen.
2. As that player, I want the card once only, so that the app does not nag me.
3. As that player, I want Not Now to hide the card for good, so that my choice is respected.
4. As that player, I want See Levels to open The Road, so that I can compare the levels.
5. As that player, I want the card to say how Formamorph AI differs from the model on my machine, so that the offer is about my situation.
6. As a player with an AMD or Intel discrete card of 8 GB or less, I want AI setup to lead with Formamorph AI, so that I get the same advice an NVIDIA player gets.
7. As a player with an integrated GPU, I want AI setup to lead with Formamorph AI, so that I know a small local model is not my only choice.
8. As a player with no GPU, I want the same lead, so that I do not start on the slowest setup without knowing the alternative.
9. As a player with a discrete card and an integrated GPU, I want the app to judge my discrete card, so that the integrated GPU does not put me in the low-VRAM group.
10. As a player with a strong card, I want no card, so that the app does not sell me something I do not need.
11. As a player on my own endpoint, I want no card, so that my setup is left alone.
12. As a Supporter, I want no card, so that I am not sold what I already have.
13. As a Steam player, I want no offer, so that the Steam build follows its store rules.
14. As a player who saw the Demo AI card and later moved to the built-in engine, I want the new card once, so that I can reconsider after I try my own machine.
15. As a player who regenerates a turn, I want that not to count, so that the card reflects real play.
16. As a player who loads a save, I want my count to stay as it was, so that old turns do not trigger the card.
17. As a player who moves narration off the built-in engine while the card shows, I want the card to go away, so that it never shows for the wrong AI.
18. As a player whose VRAM the app cannot read, I want the app to behave as it does today, so that a failed read never shows a wrong offer.
19. As an existing built-in engine player, I want the card after my next 10 turns, so that I am treated like a new player.
20. As the developer, I want to see how many players saw each card, so that I can learn which offer leads to pledges.
21. As the developer, I want the VRAM answer to come from one place, so that the setup lead and the card never disagree.

## Implementation Decisions

**VRAM class**

- The desktop shell answers one question for the renderer: the VRAM class of the device the built-in engine uses. The answer is `low`, `ok` or `unknown`.
- The answer is pure policy over three facts the shell already has: the engine's device listing with totals, the `nvidia-smi` rows, and the device the pin policy selects. It lives beside the existing device pin policy.
- Rules, in order:
  1. The listing failed, or the app is not the desktop build → `unknown`.
  2. The listing succeeded with no GPU device → `low`.
  3. The engine's device is integrated, by the existing name patterns → `low`.
  4. The engine's device is discrete → `low` when its total is at or under 8,500 MB, else `ok`.
  5. Several discrete cards with no pin → their totals are added, then rule 4 applies.
- For a discrete card that matches an `nvidia-smi` row, the `nvidia-smi` total is the total. This keeps the shipped answer at the limit for NVIDIA players. Two cases differ from the shipped code: the class judges the device the engine uses, not the first `nvidia-smi` GPU, and a failed device listing shows no lead.
- A failed listing and an empty listing must be told apart. Today both read as an empty list. A spawn error, a timeout or a non-zero exit is a failed listing. Exit 0 with no device lines is an empty one.
- "The engine's device" means the device of the next start with the saved settings: the listing of the backend that start would use, and the pin from the saved device setting.
- A manual pin on an integrated GPU beside a large card is `low`. The All GPUs setting adds the discrete totals and ignores integrated ones.
- A runtime fallback to the CPU after a failed GPU load does not change the class.
- A reported total is never trusted for an integrated GPU. Field reports range from about 2 GB to over 80 GB.
- A successful device listing is read once and cached, and the class adds no second read. A failed listing is not cached, so the next ask lists again.
- A discrete card with no known total answers `unknown`.
- The 8,500 MB limit of the VRAM class has one definition, shared by the shell policy and the renderer facts. The model tier boundary in the download recommendation is a separate number (Out of Scope).

**AI setup lead**

- The lead reads the VRAM class, not the `nvidia-smi` total. `low` shows the lead. `ok` and `unknown` keep today's layout.
- Every other condition of the lead stays (First-Time Flow Q52).
- The lead's copy says "the models that fit your GPU". That is wrong for a CPU-only machine. Ticket 01 changes it with the smallest edit, and the user approves the words (Q8).

**The card**

- Settings exposes whether narration resolves to the built-in engine, next to the existing Demo AI fact. Only the narration route decides.
- The card is due when all are true: narration is on the built-in engine, the VRAM class is `low`, hosted AI is available, the player is not pledged, the card is not seen, and the count is at least 10.
- The count and the seen record are two new per-install records, kept with the First-Time Flow records. The count stops once the card is seen.
- The count needs only the narration route and an unseen card. The VRAM class, the pledge and hosted availability gate the card, not the count. A player who becomes eligible later with 10 or more turns gets the card at the next settled turn.
- A turn that falls back to the CPU on the built-in engine still counts.
- The card reuses the story card component with its own title and body. Placement, buttons and lifetime match the Demo AI card.
- The two cards cannot show together: narration resolves to one endpoint.
- The card hides when the offer stops being available, as the Demo AI card does.
- Copy is written from a facts list under the Writing Guide and goes to the user for approval before it lands.

**Funnel**

- A new step, `engine_offer_shown` (Q16), joins the server's step list: the built-in engine card was shown. The route, the limiter and the totals table need no other change.
- The Usage report lists steps from that list, so the new step appears there. Its label in the staff view is added on the client.
- `see_levels` stays one step with no source.
- The server change deploys before a client build that sends the step. The client marks a step as sent once, so a refused send is a lost count.

**Shape and version**

- No world or save export changes. Every new record is local storage.
- No version change and no migration.

## Testing Decisions

A good test here gives facts in and reads the decision out. It never asserts how a hook or a component is built.

| Seam | What it proves | Prior art |
|---|---|---|
| Offer facts (pure) | Card due at 10 and not at 9; each excluding fact; the count rule for opening, regenerate and loaded save; `unknown` class never shows the lead or the card | The First-Time Flow facts tests |
| Engine device policy (pure) | The VRAM class for: one small discrete card, one large card, an integrated GPU alone, discrete plus integrated, CPU-only, a failed listing, two discrete cards, an NVIDIA name match | The device pin policy tests |
| Story card hook | The seen record is written once; the funnel step is sent once; a reload never brings the card back; the Demo AI card's record does not block this card | The Demo AI offer hook tests |
| Server funnel route | The new step is accepted and counted; an unknown step is still refused | The funnel route tests |

Each guard is proven by reinstating the bug once: an integrated GPU with a large reported total must fail the test when the name rule is removed.

No render test of AI setup and no Playwright test are added (Q13).

## Out of Scope

- A speed or regenerate trigger (Q2).
- A source on the `see_levels` step.
- The "Detected: …" line in AI setup, which stays NVIDIA-only.
- The model tier that AI setup recommends for AMD, Intel and CPU-only machines.
- An exception for strong APUs (Q12).
- A Steam build flag. The First-Time Flow gap stays on the Steam checklist.
- Any offer on a player's own endpoint.

## Further Notes

- **Deploy order:** FormamorphServer first, then the client build.
- **No CPU backend setting:** the Backend setting is Auto, Vulkan or CUDA. A machine is CPU-only when its listing succeeds with no GPU device.
- **Sources for the integrated GPU ruling:** a UHD 620 reporting about 2 GB, a Strix Halo APU reporting 87,722 MiB, and upstream llama.cpp issues 16092 and 18946 on dedicated-only and overflowed figures. The 47.8 GB figure in the device pin notes is an aggregate of a discrete card and an integrated GPU, not one device.
- **Changelog:** each ticket lands its own Added entry in one Formamorph AI group. The close organizes the group.
- **Close review, 2026-11-09:** three gaps went to ticket 04, which landed as fee78fb1b.
