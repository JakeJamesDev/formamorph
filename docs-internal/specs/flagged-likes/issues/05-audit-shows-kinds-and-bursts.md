# 05: Audit shows kinds and Bursts

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Implementation Decisions › Client)

Model rationale: rendering new fields in one existing dialog plus a static privacy page edit, against an API shape ticket 03 fixes.

## What to build

In **Audit the likes**, each account row and anonymous group shows its Network Kind (VPN, Hosting, Tor) when it has one; rows without a kind look as they do today. A summary line shows the flagged count and share for the last 90 days. A Bursts section lists each Burst with its time and size, and names which marker reasons fire. The client privacy page carries the same collection text, retention lines and IPLocate.io credit as the server policy from ticket 01.

## Acceptance criteria

- [x] Rows and groups with a kind show it; rows without one are unchanged. (LikersDialog tests: "shows each kind…", "leaves rows with no kind unchanged")
- [x] The summary line shows flagged count and share. ("shows the flagged count and share…", "shows no summary line when the window holds no likes")
- [x] Bursts list with time and size; an empty list shows nothing. ("lists each Burst…", "shows no Bursts section when nothing fired")
- [x] Marker reasons are named when they fire. ("lists each Burst… names the reasons")
- [x] The client privacy page matches the server policy's new lines and credit. (`hosting/privacy/index.html` read against the server policy text)
- [ ] Copy passes the `copy-sweep` skill.
- [ ] Frames: `.scratch/frames/audit-kinds-dark.png`, `.scratch/frames/audit-kinds-light.png` at a realistic desktop width, with seeded rows covering all three kinds and one Burst.

For you: open a seeded audit and judge whether VPN, Hosting and Tor read as evidence, not accusation.

## Landed

**Not verified**
- Copy passes the `copy-sweep` skill: the badge tips follow the spec session's wording and `docs/Writing-Guide.md`, but the full sweep did not run.
- Frames `audit-kinds-dark.png` and `audit-kinds-light.png`: the preview has no staff session, so the likers dialog never opened. No frames were stored.

**For you**
- Open a seeded audit and judge whether VPN, Hosting and Tor read as evidence, not accusation.
- `LikersDialog` takes an `auditOnOpen` prop for ticket 06's marker. It runs the audit as the dialog opens.
