# 07 — Connection Styles & Border-Anchor Fix

**What to build:** A per-user connection-style preference with three renderings — straight (default, today's look), bezier curves, and orthogonal elbows — applied to both authored Connections and implicit links. The dashed-implicit vs solid-authored distinction, per-direction arrows, and labels survive in every style. Separately, the border-anchoring bug for Groups is fixed: an authored Connection between a parent Group and a child inside it renders border-to-border (child border ↔ Group inner border), never to a node's center.

**Blocked by:** 04 (per-user canvas-prefs home).

Status: done

- [x] Style picker (context menu for now; toolbar later) switches straight / bezier / elbow live; choice persists per user
- [x] Dashed vs solid, arrowheads, offsets, and labels render correctly in all three styles
- [x] An authored parent↔child Connection anchors on both borders in every style
- [x] No change to world data — styles are presentation only
- [x] Pure tests for the Group border-anchor geometry; Playwright or static-frame evidence per style
