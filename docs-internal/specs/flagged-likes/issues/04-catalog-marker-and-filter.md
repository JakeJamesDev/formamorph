# 04: Catalog marker and Flagged Likes filter

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Server)

Model rationale: staff-only fields on a cached, per-reader catalog next to hidden contest likes. A leak here shows players a moderation tool.

## What to build

For staff readers, each catalog listing carries its **Likes Marker** reasons, from ticket 03's marker function. The catalog accepts a staff-only Flagged Likes filter that returns only marked listings and narrows together with the quarantined filter. A non-staff request never gets marker fields, and a filter it sends is ignored. Contest entries carry the marker for staff while their like counts stay hidden from players. Responses that carry marker fields use the existing per-reader caching. With the filter on, the catalog finds the marked listings with ticket 03's `likesMarkers(worldIds)` before it pages, so a page is never short of marked listings that sit on a later page. The catalog also reports the count of marked listings for staff, so the client can show **Flagged Likes (n)**.

## Acceptance criteria

- [ ] Staff catalog rows carry marker reasons; player and guest rows never do.
- [ ] The filter returns only marked listings for staff and is ignored for others.
- [ ] Filter and quarantined filter together return the intersection.
- [ ] A contest entry before results shows the marker to staff and still hides its count from players.
- [ ] Staff responses get the counts of marked listings; others do not.
- [ ] Marker-carrying responses are marked per reader.
- [ ] Each guard is proven to bite by reinstating its bug once.
