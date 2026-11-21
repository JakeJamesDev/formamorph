# 04: Server Accepts and Stores the Full Contribution

Status: ready-for-human
Base: 25a6b35
Blocked by: None (can start immediately)
Repo: FormamorphServer
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The contribution route accepts and stores the spec's new optional fields, so staff and replays can see what the player saw. This ticket owns the stored shape that 05 and 06 use.

New fields:
- `playerId`: the persona's entity id, or null.
- `cast`: one record per cast entity, with id, name, aliases, stranger name and kind.
- `quotes`: one record per quote, with its span, the shown speaker (id or null), the rule, the rule's mention span and the first-person mention spans.
- `clientVersion` and `readingVersion`.

**Validation:** each field is optional, bounded and validated like today's fields. A malformed field refuses the send with a reason.

**Storage:**
- Each field gets a nullable column through the boot schema.
- A row without the fields reads them as absent.
- The queue and row reads return the new fields.

Update the server's API docs for the route.

## Acceptance criteria

- [x] A submission with every new field stores them, and the queue returns them. (`stores every field and the queue returns them`)
- [x] A submission without them is accepted and reads back with them absent. (`takes a submit without them and reads them back absent`)
- [x] Each field past its bound, or of the wrong shape, is refused with an error that names it. (the `refuses a bad %s` table, 23 cases, plus `takes the fields at their bounds`)
- [x] A span in `quotes` that splits a code point or a word is refused, the same as a correction span. (`refuses a quote span that splits a word, a code point...`; mutation check turned it red)
- [x] Existing contribution rows still read and export unchanged. (`leaves the export byte-identical`; schema step test on a deployed table)

## Landed

**Not verified**
- Mutation checks ran only on the quote span guard. The resend-clears-fields behavior and the version bounds have tests but no mutation check.
- The cast `kind` set (`unique`, `generic`, null) and the rule shape (`^[a-z-]{1,40}$`) follow the spec session's ruling of this session; no client body was sent against this server.

**For you**
- None.
