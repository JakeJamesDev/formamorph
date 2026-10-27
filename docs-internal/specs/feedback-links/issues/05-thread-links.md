# 05: Thread Links

Status: done
Blocked by: 01, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q2, Q11, Q20, Q22; Link grammar; Shared rendering)

## What to build

In the app and on the website, a feedback thread shows its `#N` in the header and in list rows. `#N` and pasted thread URLs in bodies and comments render in the look ticket 01 settled, and open that thread. An unavailable thread renders the unavailable form.

This ticket owns the client link layer on the shared markdown renderer, the client parser, the client copy of the grammar case table, and the unavailable form. Tickets 06 and 07 add their link kinds to this layer.

## Acceptance criteria

- [x] The client parser passes its copy of the case table, which matches ticket 03's table. (`feedbackLinks.test.ts`, 56 cases; `src/lib/feedbackLinkCases.json` is byte-identical to the server fixture apart from line endings)
- [x] The thread view, rendered with a mocked feedback service in app mode and site mode, shows `#N` links, thread URL links and the unavailable form. (`FeedbackThreadView.links.test.tsx`, real markdown renderer; site mode also through `FeedbackPage.test.tsx`)
- [x] Code spans and code blocks show `#N` as plain text. ("keeps #N plain inside a code span and a code block")
- [x] Clicking a thread link opens that thread in the app and the matching route on the site. ("opens a linked thread in the same view, and writes to it by its UUID"; site: "opens a linked thread at its own address…", `/feedback/7`)
- [x] The site bundle boundary test stays green. (Ceiling raised 89 → 92 for the three link-layer modules; `FeedbackMarkdown.tsx` added to the site Tailwind content list)
- [x] The wiki's feedback section explains `#N` and thread links. (`docs/Community-Creations.md`, Thread Links)
- [x] Frames of a thread with each form, light and dark: `.scratch/frames/thread-links-<theme>.png`. (Playwright, dev route `feedbackThread` with `fixture=feedback`; every chip measured 0.0px off its text line)

## Landed

**Not verified**

- None.

**For you**

- Approve the `#23` labels no frame covered (spec Q35): a muted `#23` after the thread title (in the frames), and `#23 ·` at the start of each list row's meta line (open any feedback list). Frames: `.scratch/feedback-links-05/frames/thread-links-light.png`, `.scratch/feedback-links-05/frames/thread-links-dark.png`.
- A thread link with its own text, `[see this](https://formamorph.ai/feedback/23)`, shows the chip and drops `see this` (Q35).
- Notes for 06 and 07: add a chip to `CHIPS` in `src/components/menu/FeedbackMarkdown.tsx`; the plugin then marks that kind. `hrefOf` in `src/lib/remarkFeedbackLinks.ts` gives sigil links the thread address, so 07 adds the profile address there. Raw HTML can forge `<a data-link-mark="thread:x">`; it renders as an unavailable thread and leaks nothing.
