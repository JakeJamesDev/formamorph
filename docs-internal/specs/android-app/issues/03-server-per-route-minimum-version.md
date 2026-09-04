# 03 — Server per-route minimum client version

Status: ready-for-human
Type: task
Spec: ../spec.md (Implementation Decisions › The Version Requirement; Testing Decisions › Server)

Server repo. Independent of the client ticket; either order works because the setting is empty by default.

## Task

- Parse `X-Formamorph-Client` on every request into version and platform. A missing or malformed header is version zero, platform unknown.
- Log platform and version on the request line.
- Add a server setting: a map of route key to minimum semver plus a short feature label, empty by default, editable by staff through the existing settings surface.
- Middleware: when the matched route has a minimum and the client version is lower, answer `426` with `{ code: "CLIENT_UPDATE_REQUIRED", minVersion, feature }`.
- Routes without an entry are untouched.

## Acceptance

- Tests: gated route answers 426 with the body shape for an older client; passes a newer one; missing header is zero; ungated routes unaffected.
- Server gates green.

## Comments

**2026-09-04 — done, in the `FormamorphServer` repo.** All four acceptance cases are covered, and `npm test` is green: 1289 tests, 40 files, 15.4s.

Two choices the spec did not record:

- **Where the setting lives.** A new key/value `settings` table with a staff-only `GET`/`PUT /api/settings/:key`, rather than the policies table or an environment variable. Raising a minimum now needs no deploy and no restart.
- **How a route is keyed.** `METHOD /path`, matching when the method is equal and the request path is that path or sits under it. So one entry gates a feature rather than each endpoint. `HEAD` matches a `GET` key, because Express answers HEAD from the GET handler. Where two keys cover one path, the longer one wins.

What a client can rely on: `426` with `{ success, code: "CLIENT_UPDATE_REQUIRED", minVersion, feature, error }`. The extra `error` is a sentence an older client can show verbatim, the same pairing the privacy refusal already uses.

`/api/settings` is never gated. A minimum over it would refuse the one request that can lower it, and only a hand-edited database could undo that.

Two things deliberately left out:

- **No audit entry when staff write a setting.** The log records staff actions on accounts and listings; this leaves only `updated_at`. It needs a new audit action, which widens a product surface this ticket did not ask about. Worth its own ticket.
- **No staff screen.** The admin panel has no Settings tab, so raising a minimum today is one `curl`, written up in the server repo under `docs-internal/server.md`.
