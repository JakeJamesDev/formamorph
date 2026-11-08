# 05: Version Script Image Paths

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Found by the close review. The spec stays open until this lands.

## What to build

A screenshot retake reaches every visitor as one matched set. The deploy step hashes the shots folder and rewrites `/site/shots/` paths, but only inside HTML files. The hero and tour scripts build their frame paths in JavaScript, so those requests skip the hash and are cached for a day under `/site/*`. After a retake, a visitor can get new frames with old layout boxes, or the reverse, and the overlay misaligns. The hero's first frame also downloads twice: once hashed for the CSS background, once plain from the script.

The hero script, the tour script, the turn data and the layout data all take their shots path from the versioned one, so a retake changes every URL together.

## Acceptance criteria

- [ ] After the deploy step runs on a built site, every hero and tour frame request, the layout data and the turn data use the hashed path, or a path that changes with their content; none uses the plain `/site/shots/` path.
- [ ] The hero's first frame is requested once on a fresh load.
- [ ] A test on the deploy step's output proves a script-built path is versioned, and fails when the rewrite is removed.
- [ ] Pages already open during a deploy keep working (the plain folder still exists).
