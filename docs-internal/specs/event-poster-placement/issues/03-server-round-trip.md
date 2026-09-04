# 03 — Server: store and round-trip the placement

Status: done

FormamorphServer half (`D:\Documents\GitHub\FormamorphServer`) — live collaboration repo; follow
its existing migration/column conventions.

- One nullable JSON/TEXT column `poster_placement` on the events table.
- `eventController` create/edit: accept `posterPlacement`; validate (finite numbers, zoom within
  1–4, x/y within 0–1) and reject invalid shapes; omitted key = leave alone, `null` = clear.
- Clearing the poster image also clears the placement.
- Serve it back as `posterPlacement` on every event read (full and slim rows alike — it is tiny).

Tests (existing seams `tests/eventsAdmin.test.js` / `tests/eventPosters.test.js`): create/edit
round-trip, invalid shape rejected, omit-vs-null semantics, image-clear cascade. Mutation-test the
validator bounds.
