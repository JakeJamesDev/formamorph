# 03: Server Link Grammar and Targets

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q2, Q3, Q11, Q16, Q22; Link grammar; Resolved targets come with the text); server spec: Per-reader targets

Repo: FormamorphServer.

## What to build

The server reads `#N`, pasted thread URLs and pasted listing URLs in thread bodies and comments. It returns each post's resolved targets on its DTO, resolved for the reader. A target the reader cannot read, or that does not exist, comes back unavailable with no name, title or type.

This ticket owns the link grammar and the canonical grammar case table (input text → expected links with kind, target, position). Ticket 05 copies the table to the client. The table already holds `@username` cases; ticket 04 records mentions from them. This ticket owns the target shape on the DTO; ticket 04 adds user targets to it.

## Acceptance criteria

- [ ] The parser passes the case table: code spans and fenced code skipped, word boundary before `#` and `@`, URL forms, repeats, titles never parsed.
- [ ] Thread targets carry number, title, type and status when the reader can read the thread.
- [ ] A missing thread, a deleted thread, and a bug on the guest read path all return the same unavailable target.
- [ ] Listing targets carry kind, id, title and thumbnail only for a publicly visible listing. Hidden, pending and deleted listings return unavailable.
- [ ] Targets resolve in a bounded number of queries per thread read, not one per link.
