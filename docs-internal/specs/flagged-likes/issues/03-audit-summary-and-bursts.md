# 03: Audit summary and Bursts

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Server)

Model rationale: Burst counting over two like tables with a per-address rule, a windowed share, and four new settings. This ticket owns the marker computation ticket 04 reuses.

## What to build

**Audit the likes** returns the Network Kind on every account row and anonymous row, and a per-listing summary: flagged likes in the last 90 days, all likes in that window, the flagged share, every **Burst** (start time and size), and which **Likes Marker** reasons fire. A Burst is at least the Burst size of different likers within the Burst window: each account counts once, Anonymous Likes count once per address hash, and blanked hashes do not count. The flagged-share reason fires when flagged likes reach the minimum count and the share threshold. Four new settings hold the thresholds (minimum flagged 5, share 0.5, Burst size 8, Burst window 15 minutes) and apply on the next read. The marker computation is one function the catalog (ticket 04) calls; this ticket owns it. The response still never carries a hash or an Install id.

## Acceptance criteria

- [ ] Each audit row carries `networkKind`.
- [ ] The summary reports flagged count, window total, share, Bursts and marker reasons.
- [ ] 8 different likers inside 15 minutes is a Burst; 7 is not; 8 spread past the window is not.
- [ ] Three Anonymous Likes from one address count as one liker toward a Burst.
- [ ] 5 flagged of 10 fires the share reason; 4 flagged of 4 does not; 5 flagged of 11 does not.
- [ ] Likes older than 90 days count toward neither reason.
- [ ] Changing a threshold setting changes the next audit read.
- [ ] The four settings appear in the existing settings map with validation.
- [ ] Each guard is proven to bite by reinstating its bug once.
