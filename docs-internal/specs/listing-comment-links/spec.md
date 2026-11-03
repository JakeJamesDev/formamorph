# Spec: Links in Listing Comments

Status: done
Status note: Closed 2026-11-03; tickets 01–06, last landing 36cb262d2. Review: spec text corrected. Closed with a gap: ticket 04's dark frame does not exist. Gates green on 2026-11-03.
Spec session: listing-comment-links — spec

Builds on `docs-internal/specs/feedback-links/spec.md`, whose grammar and chip rulings apply here. That spec left world comments out of scope; this one brings them in. Server work happens in the FormamorphServer repo, and this spec holds its contract.

## Problem Statement

A player who writes `@name` in a listing comment sees raw text, both in the comment box's Preview and after posting. The same is true for `#23` and for a pasted listing URL. The player cannot tell whether the name is right, and a reader cannot open the profile, thread or listing.

Feedback threads already draw all of these as chips, so the two comment boxes behave differently. The feedback box's Preview also shows raw text, so no writer sees a chip before posting.

## Solution

Listing comments use the feedback link layer. `@user`, `#thread` and pasted listing URLs draw as chips in every listing comment, old and new, in the app and on the website. The listing comment box gets the same autocomplete as the feedback box.

Preview draws real chips in both the listing and the feedback comment boxes, through a new server read that resolves unposted text.

A mention in a listing comment is a link only. It sends no alert.

## User Stories

1. As a player, I want `@name` in a listing comment to draw as a chip with avatar and name, so that I can see who is meant.
2. As a player, I want to click a user chip, so that I can open that player's profile.
3. As a player, I want `#23` in a listing comment to draw as a thread chip with its title and status, so that I can see what it refers to.
4. As an app player, I want a thread chip click to open that thread in the Feedback dialog, so that I can read it without leaving the app.
5. As an app player, I want to reach a bug thread from a listing comment when I can read it, so that a bug reference works the same as any other thread.
6. As a website visitor, I want a suggestion or question chip to open its website page, so that the link works on the site.
7. As a website visitor, I want a bug thread chip to show as unavailable, so that I never land on a page the website does not serve.
8. As a player, I want a pasted listing URL to draw as a listing chip, so that I can see the title and kind before I open it.
9. As an app player, I want a listing chip click to open that listing in place, so that I stay in the community view.
10. As a reader, I want modified clicks on a chip to behave as browser links, so that I can open a new tab or copy the address.
11. As a reader, I want a hidden or deleted listing to show as unavailable, so that a comment never exposes it.
12. As a reader, I want a thread I cannot read to show as unavailable, so that a comment never exposes it.
13. As a reader, I want an unmatched `@name` to show Unknown user, so that a typo and a deleted account look the same.
14. As a reader, I want old comments to draw chips too, so that a comment thread reads the same from top to bottom.
15. As a commenter, I want `@` autocomplete in the listing comment box, so that I land the correct name.
16. As a commenter, I want `#` autocomplete in the listing comment box, so that I can find a thread by number or title.
17. As a commenter, I want autocomplete when I edit a comment, so that editing works the same as writing.
18. As a commenter, I want Preview to draw real chips, so that I can check a link before posting.
19. As a feedback writer, I want Preview to draw real chips too, so that both comment boxes behave the same.
20. As a commenter, I want Preview to stay readable when the lookup fails, so that I can still review my text.
21. As a commenter, I want a posted or edited comment to draw its chips at once, so that I don't need to reload.
22. As a commenter, I want code spans to stay literal, so that I can write `@name` as an example.
23. As a commenter, I want no limit on links beyond the comment length, so that a long reply is never refused for its mentions.
24. As a mentioned player, I want no alert from a listing comment, so that listing comments can't be used to ping me.
25. As a website visitor, I want user chips to open the profile, so that the website behaves the same as the app.
26. As a keyboard user, I want every chip to be focusable, so that I can open it without a mouse.
27. As a moderator, I want report and audit snippets to stay plain text, so that I see exactly what was typed.

## Implementation Decisions

**Rulings**

- Q1: "CC links" means pasted community listing URLs.
- Q2: Listing comments get all three link kinds, with the feedback grammar unchanged.
- Q3: Scope is comments on all listing kinds. Descriptions, changelogs, contest rules and profiles stay plain markdown.
- Q4: The listing comment box gets the feedback autocomplete, for both new comments and edits.
- Q5: A new server read resolves unposted text. Preview draws real chips in both the listing and the feedback comment boxes. This is the one exception to the feedback-links rule that the client never sends a second lookup to render.
- Q6: A mention draws a chip only. It sends no alert and writes no mention row.
- Q7: The website draws the same chips in its read-only listing comments.
- Q8: On the website, a thread chip follows its address and a bug thread shows Unavailable thread. In the app, a thread chip opens the thread in the shared Feedback dialog, bugs included.
- Q9: Chips apply to all existing comments. An unmatched `@name` shows Unknown user, the same as feedback.
- Q10: Listing comments have no mention cap. The 4,000-character comment limit is the only bound.

**Server**

- Listing comment list reads, creates and edits return `targets`, the same shape feedback uses, resolved for the reader making the request.
- The existing target resolver takes any list of texts, so a page of comments resolves in one batch. No schema change. Stored comment text stays as typed.
- New route: `POST /api/feedback/links/resolve`. It takes `{ text }` and returns `{ success: true, data: { targets } }`, the envelope every feedback route uses. It requires sign-in and has its own limiter of 60 requests a minute per account, so Preview never uses up the autocomplete budget. It accepts text up to the longest feedback body (4,000 characters). Missing or non-string text and text over the limit return 400; empty text returns 200 with no targets. It sits with the feedback search routes and shares the resolver, so it reveals nothing the search routes don't. Every signed-in reader can read every thread, so on this route only a missing thread or a hidden listing resolves as unavailable.

**App and site**

- `FeedbackMarkdown` is the renderer for listing comments. The name stays, because the link layer belongs to the feedback grammar.
- A comment with no `targets` field renders as plain markdown. This keeps comments readable against a server that has not been updated. It must never draw every link as unavailable.
- `FeedbackLinkPlace` gets one value per surface. In the app, the listing modal supplies `openThread`, which opens the shared Feedback dialog, and `openListing`, which uses the modal's listing opener. On the website, the place lists the Votable boards only, so a bug thread renders unavailable, and chips follow their addresses.
- The shared Feedback dialog opener gains a way to open a thread by number. In the app, the dialog opens above the listing modal, so closing it returns the player to the listing. When a chip opened the thread, Back closes the dialog too, because the player never came from the report form. An unsent draft stays for the next time the form opens.
- The website's link place uses relative paths, the same as the Feedback page, and no in-place openers, so chips load in the same tab and work on a preview host.
- A thread chip with an address on another host and no opener opens a new tab, the same rule a listing chip has. This keeps a chip from replacing the app window.
- The website's community page gains a profile provider around the whole page, so a user chip click opens the profile there. Every author and commenter name on that page also starts to open the profile, which the community docs already promise.
- Docs: the Mentions section of the Feedback wiki page gets the sentence on listing comments, and the Comments section of the Community Creations page gets one line.

**Preview**

- `PromptField` gains an opt-in way to replace its markdown Preview renderer. Prompt editors do not pass it and keep their current Preview.
- The comment Preview resolves its whole text each time the pane opens. Text with no links, by the client parser, sends no request. An unmounted Preview cancels its request.
- Q11: A link with no target stays as typed in Preview, with no toast, until the server answers for it. A chip stays while the text around it changes.
- Q12: In the Full Screen split pane, a link counts as finished when any text follows it. After a 500ms pause in typing, Preview asks for only the finished links it has not asked for, never per keystroke. A link that fails stays as typed until the pane opens again. Picks from autocomplete take the same path.
- A plain click on a chip in Preview never leaves the box, so it can't lose the draft. Thread and listing chips open their address in a new tab, and a bug chip does nothing. In the listing box, a thread chip may still open the Feedback dialog above the modal. A user chip opens the profile above the box in the app and in a new tab on the website.
- The new-thread box uses the same link place rules as the other surfaces: relative addresses and Votable boards on the website.

**Autocomplete**

- The listing comment box mounts the existing suggest plugin with no thread. A bare `@` lists nothing until a character follows, and `#` behaves as it does today. The app passes no thread type filter.

**Other**

- Report and audit snippets stay plain text.
- Export shape: none. Comments are server data, not part of world or save files.
- No new user-facing strings. The chips reuse their existing copy.
- Changelog: one player-facing group, with entries for chips in listing comments, autocomplete, thread chip clicks and chips in Preview.

## Testing Decisions

A good test drives the public surface: an HTTP request or a rendered component with user events. It never asserts on private helpers or SQL.

- **Server HTTP.** Listing comment reads, creates and edits carry `targets`. A thread the reader can't read and a hidden listing arrive as unavailable. A mention writes no row. The resolve route covers sign-in, rate limit, length limit and reader-dependent results. Prior art: the feedback target tests in the server repo.
- **Rendered listing modal.** The modal with a mocked service, in app and site modes: all three chip kinds, the unknown and unavailable forms, a comment with no `targets`, chips after post and after edit, a thread chip opening the Feedback dialog in the app, and a bug thread unavailable on the site. Prior art: the existing listing modal comment tests and the feedback thread link tests.
- **Rendered feedback comment box.** Preview with a mocked resolve: chips after resolve, plain markdown while waiting and on failure, a dropped stale response, no request for text with no links. Prior art: the existing feedback thread and `PromptField` Preview tests. A `PromptField` with no opt-in keeps its current Preview.
- **Site bundle boundary.** The existing boundary test stays green.

The grammar case table does not change, so it needs no new cases.

## Out of Scope

- Alerts, badges or inbox messages for listing comment mentions (Q6).
- Links in listing descriptions, changelogs, contest rules, profiles or messages (Q3).
- Posting listing comments on the website. It stays read-only.
- Any change to the link grammar or the chip looks.
- Links in report and audit snippets.

## Further Notes

- **Deploy order.** The server ships first. The app tolerates an older server through the plain-markdown fallback for both comments and Preview.
- **Old off-site handles.** Under Q9, an old comment such as `@name on Discord` shows Unknown user, and the typed text is lost from view. This was accepted in the grill.
- **Silent mentions.** A commenter may expect `@name` to notify. Listing comment alerts would be a separate effort.
