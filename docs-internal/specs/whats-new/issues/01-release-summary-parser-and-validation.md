# 01: Release Summary Parser And Release Validation

Status: ready-for-human
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

- [x] The parser returns the full 3.7.0 shape from the seed file: two Major items with icons, one pair (Daily routines with Map strangers), two New items, and the Fixes text. (`releaseSummary.test.ts`, "parses to the full 3.7.0 shape with no problems")
- [x] Fixture tests cover: missing `## New` and `## Fixes`, a Major item without a pair, an unmapped emoji, an unknown heading, a missing title, a trailing Full changelog link that is ignored, and a hand-edited body with extra content. (`releaseSummary.test.ts`, one case each; guards re-broken once each and seen red)
- [x] The validator script exits 0 on the seed file and non-zero on an invalid fixture, and prints each problem. (`validateReleaseSummary.test.mjs`, exit codes and stderr lines)
- [x] The release workflow runs the validator before publishing and builds the release body as the summary plus a Full changelog link. (`validateReleaseSummary.test.mjs` reads `release.yml`: validation precedes `npm ci` in the build job, publish uses `--body > notes.md`)
- [x] A changelog fragment in `docs-internal/changelog.d/` has a ⚙️ entry for the release workflow change. (`whats-new-01.md`)

For you: read `docs/whats-new/3.7.0.md` rendered on GitHub and confirm it reads cleanly as plain markdown.

## Landed

**Not verified**

- The workflow has not run on a real tag. The validator step and the `--body` publish step are checked only by reading `release.yml` in a test.

**For you**

- Read `docs/whats-new/3.7.0.md` rendered on GitHub and confirm it reads cleanly as plain markdown.
- The next release needs `docs/whats-new/<version>.md` before tagging, or the build job fails. The release skill does not draft it yet; the spec session updates the skill.
