# 06: Personas and Community Wording

Status: done
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: split decisions on Community-Creations, then a rewrite under fixed rules.

## What to build

Check each page's structure, then rewrite these pages under the Writing Guide: [Personas](../../../../docs/Personas.md), [Persona-Authoring](../../../../docs/Persona-Authoring.md), [Community-Creations](../../../../docs/Community-Creations.md).

**Structure first.** Assess Community-Creations for a split: it runs over 4,000 words. Split a page when it serves readers who come for different tasks, such as play vs authoring or setup vs reference; word count alone never splits a page. Send each proposed split (the page, the new pages, and the reader task of each) to the spec session and wait for its ruling. Land the ruled splits before the rewrite, so the rewrite covers the new pages. Every page also gets a readability check: headings a reader can scan, steps as lists, no section that buries its point.

Read "Before you write", "Labels, capitalization, and complete sentences" and "Controlled product terms" first. Run `npm run copy:sweep` on the pages and triage each notice under the copy-sweep skill. Write the rewrite yourself. Change no facts: a fact that looks wrong goes to the spec session.

Carried from ticket 05: Community-Creations names Formaquestion Settings in two tables without saying it opens from the Formaquestion window. Add the path (Q17).

Spec: Implementation Decisions, "Structure check", "Wording pass", "Headings and anchors".

## Acceptance criteria

- [x] Each page over 4,000 words has a recorded split decision here: the ruling, or "no split" with the one reader task it serves. Community-Creations (6,189 words) splits three ways, ruled by the spec session 2026-10-31:
  - **Community-Creations**: get and share creations (browse, download, like, comment, follow, publish, contests, Reports).
  - **Account**: manage your login and account (Login and Register, privacy policy, username rename, User Profile dialog, profile image, deletion).
  - **Feedback**: report a bug, suggest something or ask the team (the Feedback window and its threads).
  - Personas (1,810) and Persona-Authoring (3,239): no split, confirmed. Personas serves playing as a persona; Persona-Authoring serves making a world's personas.
- [x] A split page's new pages are in the sidebar and Home, and every anchor table that named a moved heading points at its new page. `_Sidebar.md`, `Home.md`, `surfaceMap.ts` (auth, privacyPolicy, usernameRename, profile.*, deleteAccount, feedbackHub) and the `Prompts.md` link; a grep finds no link left on a moved anchor
- [x] Every copy-sweep notice on the pages is fixed or triaged as a false positive; the count before and after is recorded here. Before: 144 on 3 pages. After: 129 on 5 pages, all false positives. 75 em-dash, 31 long-sentence, 14 term-character, 2 figurative and 2 term-picture notices sit in `keywords`/`route` comments (search terms in player words). The rest quote a label (**—**, **Checking…**, **Character Name** twice) or a literal URL (`…/world/…`)
- [x] Control names take the exact casing of the on-screen label. Labels carry over from ticket 05; the one new label pair, **More Actions** → **Settings**, read in `FormaquestionMenu.tsx`
- [x] Product terms match "Controlled product terms". "picture" → image in prose; the "Custom Character" example is now *Stranger*; an entity is "it"
- [x] Paragraphs are short and steps are scannable lists. Run-ons became lists or tables: publish limits, mention limits, statuses, the podium, the import report, removing or deleting a Custom Persona
- [x] No fact changed: a diff read finds no new claim, limit or default. Hand diff read; the only additions are the ruled Q17 path and five route lines (Landed)
- [x] A renamed heading updates every anchor table that names it; the docs tests are green. One heading renamed (Feedback's "The Feedback Window", Landed); other moved headings keep their wording. `src/lib/docs` plus `sectionVectors.test.ts`: 316 green

## Landed

**Not verified**

- None.

**For you**

- Read [Account](../../../../docs/Account.md) and [Feedback](../../../../docs/Feedback.md) as new wiki pages, and the sidebar order (both sit under Community Creations).
- Account's five sections were H3s under one "Your Account" H2. As H2s, the docs test needs a route line on each, so Take Me There now resolves auth, privacyPolicy, usernameRename, profile and deleteAccount to their own section.
- Feedback's moved "Bugs and Suggestions" H2 became "The Feedback Window" (spec session ruling): a heading equal to its page title gives a duplicate pick line, which `helpPicks.test.ts` refuses. `feedbackHub` now anchors on it.
- Q17 carry-over: the ruling named "the gear's label", but source has no gear. Formaquestion Settings opens from the **More Actions** icon button (⋮) → **Settings** (`FormaquestionMenu.tsx`), and the page says that.
- `sectionVectors.json` stays stale for the moved sections until the close rebuild (Q7).
- Three help-baseline cases pointed at moved sections and now point at Account: `help-baseline-cases.json` (avatars-2, community-creations-2) and `help-recall-blind-cases.json` (community-b4, whose gone `#your-account` became `Account#account-deletion`). No baseline run (Q6).
- The blind recall set needs two task questions per guide page, so it gains account-b1, feedback-b1 and feedback-b2 (user ruling via the spec session). A page-blind subagent wrote them from a feature list; this ticket only mapped their sections. The help baseline set gains community-creations-3, feedback-1 and feedback-2 the same way, for its two-per-page rule; this ticket mapped section, expectSurface and facts.
- Feedback gains two new H3s, "Statuses" and "Mention Limits", split out of long paragraphs.
- Formaquestion.md calls the same control "the **⋮** menu"; this ticket names it **More Actions** (its tooltip and accessible name), per Q12. The Formaquestion wording ticket owns that page.
