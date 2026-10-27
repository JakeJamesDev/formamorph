# 03: Server Link Grammar and Targets

Status: done
Base: 872f0f8
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q2, Q3, Q11, Q16, Q22; Link grammar; Resolved targets come with the text); server spec: Per-reader targets

Repo: FormamorphServer

## What to build

The server reads `#N`, pasted thread URLs and pasted listing URLs in thread bodies and comments. It returns each post's resolved targets on its DTO, resolved for the reader. A target the reader cannot read, or that does not exist, comes back unavailable with no name, title or type.

This ticket owns the link grammar and the canonical grammar case table (input text → expected links with kind, target, position). Ticket 05 copies the table to the client. The table already holds `@username` cases; ticket 04 records mentions from them. This ticket owns the target shape on the DTO; ticket 04 adds user targets to it.

## Acceptance criteria

- [x] The parser passes the case table: code spans and fenced code skipped, word boundary before `#` and `@`, URL forms, repeats, titles never parsed. (`feedbackLinks.test.js` "the link grammar", 56 cases from `tests/fixtures/feedbackLinkCases.json`; "is never read from a title")
- [x] Thread targets carry number, title, type and status when the reader can read the thread. ("carries number, title, type and status…", "resolves the bug for a signed-in reader")
- [x] A missing thread, a deleted thread, and a bug on the guest read path all return the same unavailable target. ("is the same unavailable target for a missing thread, a deleted thread and a bug read by a guest")
- [x] Listing targets carry kind, id, title and thumbnail only for a publicly visible listing. Hidden, pending and deleted listings return unavailable. ("carries kind, id, title and thumbnail…"; "is unavailable when hidden, pending, quarantined, deleted or of another kind, even to its author and staff")
- [x] Targets resolve in a bounded number of queries per thread read, not one per link. ("resolve in the same number of queries however many links a thread holds": 1 link + 1 comment and 24 links + 5 comments use the same statement count)

## Landed

**Not verified**
- None. Every guard above was mutation-tested: each mutant failed at least one test.

**For you**
- DTO shape (spec session Q32): each thread, comment and `acceptedAnswer` carries `targets`, one entry per distinct link in text order: `{ kind, ref, available, ... }`. Status, lock, vote and answer responses carry it too.
- `@a.b` does not link: the 3–20 length rule wins over the spec-session note that suggested it links `a`. The table records `@ann.lee` → `ann` instead.
- Undecided edges the table now records, for the client to copy or for you to rule on: a host in capitals does not link, a URL after a letter (`xhttps://…`) links, and a backtick fence with a backtick in its info string is not a fence.
- Thread search (ticket 08) imports `threadSummary` from `src/utils/feedbackTargets.js`.
