# 03 — Server per-route minimum client version

Status: ready-for-agent
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
