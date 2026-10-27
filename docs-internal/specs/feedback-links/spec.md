# Spec: Links in Feedback Threads

Status: done
Status note: Closed 2026-10-27; tickets 01–12, last landing 43aac7eeca. Review: spec text corrected; gaps landed as tickets 10–12. Gates green on 2026-10-27.
Spec session: feedback-links — spec

Server side: the FormamorphServer repo, `docs-internal/specs/feedback-links/spec.md`. It holds the thread number, mention and link-target contract. This spec holds the rulings (Q1–Q38) and the user stories.

## Problem Statement

Feedback text is plain prose. A player who wants another player to see a thread must tell them outside the game. A player who refers to an earlier suggestion must copy its title and hope the reader finds it. A player who discusses a world or an entity from the community catalog cannot point at it. Threads have no short name, so nobody can say "see thread 23".

## Solution

Feedback thread bodies and comments understand three kinds of links, the way GitHub does:

- `@username` links to a user. On a Votable board it also makes that user a party to the thread, so the thread badges them until they read it, and later comments badge them too.
- `#N` links to another feedback thread. Every thread gets a short number from one shared sequence. A pasted thread URL also links.
- A pasted community listing URL shows as a chip with the listing's title.

The text is stored exactly as typed. The app and the website show links at read time, through the shared feedback components. A link to something the reader cannot see, or that does not exist, shows in an "unavailable" form that does not leak a name or a title. The editor suggests users after `@` and threads after `#`.

## User Stories

1. As a player, I want to type `@username` in a comment, so that a specific player sees the thread.
2. As a mentioned player, I want the thread to count on my feedback badge, so that I know someone asked for me.
3. As a mentioned player, I want later comments on that thread to badge me, so that I can follow the discussion I was pulled into.
4. As a mentioned player, I want opening the thread to clear the badge, so that the badge works the same as for a thread I replied to.
5. As a mentioned player on a suggestion or question, I want the thread marked unread in the board lists, the same as a thread I replied to, so that I can find it again.
6. As a player, I want `@username` to work regardless of letter case, so that `@Alice` and `@alice` reach the same account.
7. As a reader, I want a mention to link to the player's profile, so that I can see who was mentioned.
8. As a reader, I want a mention of an account that does not exist to show as "unknown user", so that a deleted account's name never shows.
9. As a player who mentions themself, I want no badge and no cap use, so that a self-mention is harmless.
10. As a player who repeats a mention, I want it counted once, so that `@a @a` does not use two of my cap.
11. As a non-staff player, I want to mention up to 5 players per post, so that I can pull in the people who matter.
12. As a moderator, I want to mention up to 10 players per post, so that I can gather the right people on a thread.
13. As an admin, I want no mention cap, so that I can notify everyone a thread concerns.
14. As a player over my cap, I want the post refused with a message that names the cap, so that I know what to change.
15. As a player who edits a post to add a mention, I want that player badged, so that a late mention works.
16. As a player who edits a mention out, I want that player's claim dropped, so that a mistaken mention stops badging them.
17. As a mentioned player who also replied, I want my reply to keep the thread mine after the mention is removed, so that my own participation stays.
18. As a player whose post is deleted, I want its mentions to stop badging, so that a deleted post has no effect.
19. As a reporter, I want a mention in my bug report to link without badging, so that mentions never pull other players into the bug queue.
20. As a player, I want every thread to show its number, so that I can refer to it.
21. As a player, I want to type `#23` to link thread 23, so that I can point at an earlier discussion.
22. As a player, I want a pasted thread URL to link the same way, so that a copied address works.
23. As a reader, I want a thread link to show its title, type and status, so that I know where it goes before I open it.
24. As a reader, I want a link to a thread I cannot read to look the same as a missing thread, so that a bug's existence never shows.
25. As a website visitor, I want a `#N` to a bug to show as unavailable, so that the website never shows bugs.
26. As a player, I want `#N` inside code to stay plain text, so that I can quote text that contains a hash.
27. As a player, I want `@name` inside code to stay plain text, so that I can quote a username without a mention.
28. As a player, I want a pasted community listing URL to show as a chip with its title, so that readers know what I mean.
29. As a reader, I want a listing that is hidden, pending review or deleted to show an unavailable chip, so that hidden content never shows its title.
30. As a player, I want the thread address to be `/feedback/23`, so that the link I share matches the number.
31. As a player typing `@`, I want the editor to suggest players already in the thread first, so that I can mention them fast.
32. As a player typing `@`, I want any other player found by username prefix, so that I can mention someone new.
33. As a player typing `#`, I want threads suggested by number or title, so that I do not have to remember the number.
34. As a player typing `#`, I want only threads I can read suggested, so that the editor never shows a hidden thread.
35. As a keyboard user, I want to pick a suggestion with the arrow keys and Enter, so that I can mention without a mouse.
36. As a website visitor, I want the same links, chips and autocomplete as the app, so that both surfaces read the same.
37. As a guest on the website, I want links to render, so that I can follow them without an account.

## Implementation Decisions

- **Rulings (grill, 2026-10-27).**
  - Q1: A user link is `@username`.
  - Q2: A thread link is `#N`, or a pasted feedback thread URL.
  - Q3: A content link is a pasted community listing URL. It shows as a chip with the listing's title. There is no content sigil.
  - Q4: The server parses on write and records mentions. The text is stored as typed. The client renders links at read time.
  - Q5: A mention makes the user a party to the thread, the same as a reply.
  - Q6: In a bug thread, a mention links but never badges.
  - Q7: Bugs, suggestions and questions share one `#N` sequence.
  - Q8: Mention cap per post: admin none, moderator and dev 10, everyone else 5.
  - Q9: A post over the cap is refused.
  - Q10: Mention claims follow the current text. An edit re-parses. A deleted post drops its mentions. Other participation stays.
  - Q11: `#N` to a bug links only where the reader can read it.
  - Q12: `@` and `#` autocomplete ship in this effort.
  - Q13: The thread URL is `/feedback/<N>`. The UUID stays internal.
  - Q14: The badge is the only signal. No inbox message, no email.
  - Q15: `@` suggests thread participants first, then a username prefix search over all accounts.
  - Q16: A hidden, pending or deleted listing shows an unavailable chip.
  - Q17: `#` searches number prefix or title words, over threads the writer can read.
  - Q18 / Q23: An unknown `@name` shows as "unknown user" and hides the typed name. A typo and a deleted account look the same.
  - Q19: The cap counts distinct users. A self-mention does not count.
  - Q20: Settled by Q25–Q28: every link kind is a chip.
  - Q21: The spec ships now. The first ticket is a `/prototype` of the `#N`, `@` and content-chip looks. The render work waits on it.
  - Q22: A deleted or missing thread, or a bug the reader cannot read, shows the same unavailable form.
  - Q24: Test seams as listed under Testing Decisions.
  - Q25 / Q27 (prototype review, 2026-10-27): all link kinds share one look family, and that family is chips. `#N` is the titled chip (type icon, number, title, status dot). `@user` becomes a chip with the avatar and name. Listings stay as framed. Chips need no hover, so touch works the same.
  - Q26: The listing chip, the unavailable listing chip and the "unknown user" form ship as framed in ticket 01.
  - Q28: Ticket 01 reopens for a second pass that frames the chip family for all three kinds together. Tickets 05, 06 and 07 build from that pass's frames.
  - Q29 (second-pass review, 2026-10-27): chips show no `@` or `#` sigil; the avatar or type icon marks the kind. A chip is 20px tall, the line height of the 14px text, with a 16px avatar, thumbnail or icon, and equal inner padding on both sides. Every chip centers on its text line (`vertical-align: top` at line height); `inline-flex` alone takes its baseline from the first child and misaligns each kind differently. Frames: `.scratch/feedback-links-01/frames/links-chips-*.png`. Prototype patches sit beside them.
  - Q30 (ticket 02, from Q22): a thread number is never reused. A deleted thread's number stays dead, so an old `#N` or `/feedback/<N>` link shows the unavailable form and never opens a later thread. A counter advances with each insert.
  - Q31 (ticket 08): the autocomplete reads are `GET /api/feedback/search/users` and `GET /api/feedback/search/threads`, 8 results each, rate-limited per account. The username search matches every existing account. With an empty query and a thread given, it returns that thread's participants (reporter and commenters); with no thread, nothing. The thread search takes an optional `types` filter. The website editor passes the Votable boards only, because the website never serves bugs; the app passes none.
  - Q32 (ticket 03, grammar): a username token is `@` + `[A-Za-z0-9_-]{3,20}`. A name with any other character cannot be mentioned, and the username search returns only mentionable names. `#`/`@` link at text start or after a character that is not a letter, digit, `_`, `@`, `#`, `&`, `/` or backtick. `#N` is `#[1-9]\d{0,14}` with no word character after it. URLs need `http(s)://` and the site host (with or without `www.`), path `/feedback/<N>` or `/community/<world|entity|dictionary|prompt>/<id>`, and may sit inside a markdown link or autolink; trailing punctuation is not part of the URL. Fenced blocks and inline code spans are skipped; indented code is not. A thread may link itself. Each thread, comment and accepted-answer DTO carries `targets`: one entry per distinct target, in first-appearance order, `{ kind, ref, available, …fields }`; the client matches links to targets by kind + ref. Thread reads, list rows and write responses all carry targets. The canonical case table is a JSON fixture in the server repo with UTF-16 start/end offsets.
  - Q33 (ticket 03 landing, b806e5a6ba): the case table as landed is the grammar. It also records: `@ann.lee` links `ann` (`@a.b` does not link: `a` is under 3 characters); a host in capitals does not link; a URL right after a letter (`xhttps://…`) links; a backtick fence whose info string holds a backtick is not a fence. The client copies these as they are. The server's thread summary helper is the one shape for thread targets and thread search results.
  - Q34 (ticket 04): a mention row keeps the time it was first recorded and counts as unread news from then; an edit that keeps it keeps that time, and a mention removed and added back is new. Mention rows are recorded on every type; a move from bug to a Votable board seeds read markers for the mentioned users, as for voters, so the move alone raises no badge. Self and the cap come from the writer of the request, at write time, on every type. A name resolves the way the profile-by-name read does: exact spelling first, else the oldest shown account. Only an account whose profile is shown is mentionable; a suspended account and the `[deleted user]` row are unknown, and the username search leaves them out (replaces "every existing account" in Q31). A user target keeps the lower-cased name as its ref and adds id, username and avatar when available.
  - Q35 (ticket 05): ticket 05 swaps the site's thread route to `/feedback/<N>` with no UUID fallback, because the website board was never released. In the app a thread chip opens the linked thread in the pane that holds the current one; there is no thread-to-thread history. The site renders a bug target as unavailable. The unavailable thread form ships as framed. The thread header shows a muted `#23` after the title, and list rows show it at the start of the meta line; these are labels, not chips, and need the user's approval at landing. A markdown link whose URL is a thread renders as the chip and drops its custom text. Ticket 05 owns the client parser, the copied case table, the `FeedbackLinkTarget` type and one `FeedbackMarkdown` component with per-kind slots that tickets 06 and 07 fill.
  - Q36 (ticket 06): in the app a listing chip opens the community view through the existing listing opener and closes the feedback dialog, as the profile dialog does. With no opener, the chip follows its href, the site route `/community/<kind>/<id>`. The chip has a 16px thumbnail (a kind icon when the thumbnail is missing), the bold title and the muted kind word. The unavailable listing chip shows "Unavailable listing" with no link and no ref.
  - Q37 (ticket 07): the cap refusal shows through the existing error toast, and the typed text stays, for a reply, a new thread and a body edit. In the app a user chip opens the profile dialog; on the site it is an anchor to `/u/<username>`. The available chip is a 16px avatar (initial fallback) and the name as the account spells it. The unavailable form reads "Unknown user", and the typed name appears nowhere in the DOM or its attributes.
  - Q38 (ticket 09): autocomplete reuses the client parser's code mask and boundary rule; an unmatched backtick earlier in the paragraph counts as an open code span while typing. It runs in thread body and comment editors only, never titles or staff notes. A bare `@` lists the thread's participants (nothing in the new-thread form); a bare `#` lists nothing until a character follows. A pick inserts `@<stored name>` or `#N` plus a space. Rows follow the `{` chip menu: user rows show avatar and name, thread rows a muted `#N` and the title; an empty result closes the menu. Tab and Enter pick; Escape keeps it shut for that run. Requests debounce at 150 ms; stale, failed or rate-limited responses close the menu silently. The website sends the Votable boards as `types`; the app sends none.
- **Link grammar.** One grammar, two parsers: the server's (for mentions and target lookup) and the client's (for render positions). Both skip fenced code blocks and inline code spans. `@` and `#` need a word boundary before them, so an email address or a `C#` stays plain. A username token follows the server's username rules. Links parse in thread bodies and comments, never in titles.
- **Thread number.** Each thread carries a `number`, returned on every thread DTO and shown in the thread header and list rows. The website and app routes address a thread by number.
- **Resolved targets come with the text.** Each thread and comment DTO carries the resolved targets for its own text, resolved for the reader making the request. The client never sends a second lookup to render. A target the reader cannot see arrives as unavailable, with no name, title or type.
- **Shared rendering.** One feedback link layer sits on the shared markdown renderer and is used by the feedback thread view in the app and on the site. It must stay inside the site bundle boundary: no game imports.
- **Profile and listing destinations.** A user link opens the user's profile; a listing chip opens the listing; a thread link opens the thread. Each surface opens its own route for these. The app opens the in-app view where one exists.
- **Autocomplete.** Builds on the existing suggestion list and keyboard handling in the editor components. Suggestions come from two new server reads: a username prefix search and a thread search by number or title. Both respect read rules.
- **Over-cap refusal.** The server refuses the write with an error that names the cap. The client shows it in the existing error toast and keeps the typed text (Q37).
- **Export shape.** None. Feedback is server data, not part of world or save files.

## Testing Decisions

- A good test drives the public surface: an HTTP request, a rendered component with user events. It never asserts on private helpers or SQL.
- **Grammar case table.** One table of input text → expected links (kind, ref, position), covering code spans, code blocks, word boundaries, case, repeats and URL forms. The server repo holds the canonical table (Q32, Q33); the client holds a copy and runs its parser against it. A grammar change updates both copies.
- **Rendered thread.** The feedback thread view rendered with a mocked feedback service: user links, thread links, listing chips, the unknown-user form and the unavailable forms. Run it once in app mode and once in site mode. Prior art: the feedback thread view tests and the community page link integration tests on the site.
- **Editor autocomplete.** The editor with `@` and `#` typed: participant ranking first, prefix search second, readable threads only, keyboard pick. Prior art: the token autocomplete and suggestion list tests.
- **Site bundle boundary.** The existing boundary test must stay green with the link layer in the site bundle.

## Out of Scope

- Inbox messages or email for mentions (Q14).
- Staff tools on the website.
- Closing the open bug-read rule. Any signed-in app user can read the bug queue today, diagnostics included. This effort works within that rule and does not change it.
- Links in thread titles.
- Mentions anywhere outside feedback (world comments, profiles, messages).

## Further Notes

- **Website feedback effort.** `docs-internal/specs/website-feedback/spec.md` still uses `/feedback/<id>`. Q13 changes it to `/feedback/<N>`. That spec's session needs this ruling before its routing ticket lands.
- **Username characters.** Names outside the Q32 token set cannot be mentioned. A character rule for usernames is tracked in `docs-internal/specs/username-charset/spec.md`, to grill later.
- **Bug-read rule.** When the bug-read rule tightens, Q11 and Q22 already behave right: a bug a reader cannot read is unavailable.
