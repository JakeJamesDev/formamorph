# 06: Write The Changelog Entry

Status: ready-for-human
Base: 7accac0b
Blocked by: 02, 03, 04, 05
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: low

One changelog entry and a copy sweep over the strings the other tickets added. Sonnet at low effort.

## Parent

`docs-internal/specs/publish-size/spec.md`

## What to build

The In Progress changelog gains one user-facing entry that tells an author: the World Doctor shows Publish Size with a color bar, an over-limit world raises a finding, publishing refuses an over-limit item before upload, an entity takes any number of images and generation always adds one, and the publish limit is now 100 MB. The new labels, tip, finding, and refusal strings pass the copy sweep.

## Acceptance criteria

- [x] One entry under In Progress, Added, user-facing, in the changelog lead style
- [x] `npm run copy:sweep` reports no drift on the new strings
- [x] Four gates green

## Blocked by

- 02, 03, 04, 05

## Comments

- 2026-09-10: Standards and Spec review against `7accac0b` came back with one finding: three sentences in the first draft ran long and stacked more than one topic, against the STE100 rule. Split into shorter single-topic sentences and re-verified with `copy:sweep` and the four gates. Spec review found no missing, extra, or inaccurate content. A "such as '12.4 MB of 100 MB'" style readout example was left out on purpose — the exact readout format ("100.0 MB" vs. the spec's "100 MB") is an open item on ticket 03, not yet resolved.
