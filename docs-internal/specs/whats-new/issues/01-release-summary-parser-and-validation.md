# 01: Release Summary Parser And Release Validation

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Each release gets one Release Summary file, and the release workflow refuses to ship without a valid one. The spec covers this in Q0c, Q1, Q2, Q5, Q11, Q12, Q15 and Q16, and in the "Release Summary format" decision.

- **Parser.** A pure module turns summary markdown into a typed summary: version, intro paragraphs, Major items with an emoji icon and an optional paired New item, New items, and Fixes text. It reports validation problems as errors and warnings: unknown heading, missing title, a Major item without an emoji, an emoji outside the icon map, an empty summary, and a length warning. Any content after the last section is ignored, such as a trailing Full changelog link. It has no imports and no DOM, because the release workflow loads it too. The changelog slice that the Vite config loads is the precedent.
- **Emoji icon map.** A fixed table maps emoji to Lucide icon names, beside the parser. This ticket owns the table. Ticket 02 renders from it.
- **Seed file.** `docs/whats-new/3.7.0.md` holds the 3.7.0 Discord post in the spec's format. It is the parser's main fixture and the dev build's bundled summary.
- **Release workflow.** Before any artifact publishes, the release job validates `docs/whats-new/<tag version>.md` with the parser. It fails on errors and prints warnings. The release body becomes the summary file plus a Full changelog link. Today's bold-lead extraction stays in the repo; ticket 03 uses it for Recent Changes.
- **Validator script.** A small script runs the validation on a file path and exits non-zero on errors. The workflow calls it, and so does the release skill.

## Acceptance criteria

- [ ] The parser returns the full 3.7.0 shape from the seed file: two Major items with icons, one pair (Daily routines with Map strangers), two New items, and the Fixes text.
- [ ] Fixture tests cover: missing `## New` and `## Fixes`, a Major item without a pair, an unmapped emoji, an unknown heading, a missing title, a trailing Full changelog link that is ignored, and a hand-edited body with extra content.
- [ ] The validator script exits 0 on the seed file and non-zero on an invalid fixture, and prints each problem.
- [ ] The release workflow runs the validator before publishing and builds the release body as the summary plus a Full changelog link.
- [ ] A changelog fragment in `docs-internal/changelog.d/` has a ⚙️ entry for the release workflow change.

For you: read `docs/whats-new/3.7.0.md` rendered on GitHub and confirm it reads cleanly as plain markdown.
