# 06 — Exports via the share sheet

Status: ready-for-agent
Type: task
Blocked by: 04
Spec: ../spec.md (Implementation Decisions › Exports on Android)

## Task

- Add the Capacitor Filesystem and Share plugins at live latest versions.
- In the single download helper: when the Android bridge exists, write the blob to the cache directory and open the share sheet with the file; otherwise keep the anchor path. Callers unchanged.
- Confirm imports (world, save, card, VRM) work through the normal file input on the phone.
- Changelog In-Progress entry, 👤 bucket.

## Acceptance

- One test file covering the anchor path and the share path with a fake bridge.
- On the phone: world JSON, a save, and a character card each open the share sheet and arrive intact in Files.
- Four gates green.
