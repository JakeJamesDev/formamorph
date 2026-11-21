# 04: Server Accepts and Stores the Full Contribution

Status: ready-for-agent
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

- [ ] A submission with every new field stores them, and the queue returns them.
- [ ] A submission without them is accepted and reads back with them absent.
- [ ] Each field past its bound, or of the wrong shape, is refused with an error that names it.
- [ ] A span in `quotes` that splits a code point or a word is refused, the same as a correction span.
- [ ] Existing contribution rows still read and export unchanged.
