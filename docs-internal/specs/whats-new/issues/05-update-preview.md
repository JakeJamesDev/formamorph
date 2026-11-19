# 05: Update Preview

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

When an update is available, the player can read the new version's summary before downloading it. The spec covers this in Q7 and Q10, and in the "Update preview" decision.

- **Link.** The update-available banner gets a link that shows the newest available release's summary in the same What's New layout. The player can get back to the installed version's summary.
- **Source.** Parse the newest available release's GitHub body with the Release Summary parser. Only the newest version is previewed, which is the one Download installs. If its body does not parse, the banner offers no preview link.
- **Copy.** Write the link and any heading per `docs/Writing-Guide.md`.

## Acceptance criteria

- [ ] Host test: with two newer releases available, the preview shows the newest one's highlights.
- [ ] Host test: a newer release whose body does not parse shows no preview link, and the dialog still works.
- [ ] The installed version's summary is reachable again from the preview.
- [ ] The dev route's update-available state shows the preview link.
- [ ] Frame `.scratch/frames/update-preview-dark.png`: the preview at 1440×900, dark theme.
