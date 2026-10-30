# 03: Audit summary and Bursts

Status: ready-for-human
Base: 7d97017
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Server)

Model rationale: Burst counting over two like tables with a per-address rule, a windowed share, and four new settings. This ticket owns the marker computation ticket 04 reuses.

## What to build

**Audit the likes** returns the Network Kind on every account row and anonymous row, and a per-listing summary: flagged likes in the last 90 days, all likes in that window, the flagged share, every **Burst** (start time and size), and which **Likes Marker** reasons fire. A Burst is at least the Burst size of different likers within the Burst window: each account counts once, Anonymous Likes count once per address hash, and blanked hashes do not count. The flagged-share reason fires when flagged likes reach the minimum count and the share threshold. Four new settings hold the thresholds (minimum flagged 5, share 0.5, Burst size 8, Burst window 15 minutes) and apply on the next read. The marker computation is one function the catalog (ticket 04) calls; this ticket owns it. The response still never carries a hash or an Install id.

## Acceptance criteria

- [x] Each audit row carries `networkKind`. `likesMarker.test.js` › "carries the kind on a flagged row and null on a plain one", account and anonymous; `likesAudit.test.js` exact row shapes.
- [x] The summary reports flagged count, window total, share, Bursts and marker reasons. "reports the flagged count, the window total …", plus null share at zero likes, both reasons in order, and no hash or Install id in the body.
- [x] 8 different likers inside 15 minutes is a Burst; 7 is not; 8 spread past the window is not. "finding a Burst", plus the inclusive 15:00 edge and merged versus separate runs.
- [x] Three Anonymous Likes from one address count as one liker toward a Burst. "who counts as a different liker", both sides of 8, plus a blank hash never counting.
- [x] 5 flagged of 10 fires the share reason; 4 flagged of 4 does not; 5 flagged of 11 does not. "the flagged-share reason", plus flagged Anonymous Likes.
- [x] Likes older than 90 days count toward neither reason. "counts likes older than 90 days toward neither reason": 8 flagged likers at 91 days give no Burst and no flags.
- [x] Changing a threshold setting changes the next audit read. One test each for Burst size, Burst window, and minimum with share, through `PUT /api/settings`.
- [x] The four settings appear in the existing settings map with validation. `src/config/settings.js`; defaults read back, bad values refused with 400, edge values taken.
- [x] Each guard is proven to bite by reinstating its bug once. 16 mutations (distinct likers, blank hash, inclusive window, merging, share at threshold, minimum count, 90-day cutoff, settings read per call, four validators plus the integer check, both row kinds): all 16 went red, the validators rerun after the review fold-in.

## Landed

**Not verified:**

- None. Every criterion above is ticked.

**For you:**

- The four thresholds show in the Server Settings tab as `likes_marker_min_flagged`, `likes_marker_share`, `burst_size` and `burst_window_minutes`. Check that the tab edits a number value cleanly.
- `likesMarkers(worldIds)` in `src/utils/likesMarker.js` takes one id list. Ticket 04 should filter marked listings before it pages the catalog.
