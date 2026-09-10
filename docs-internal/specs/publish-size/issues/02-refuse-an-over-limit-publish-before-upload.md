# 02: Refuse An Over-Limit Publish Before Upload

Status: ready-for-human
Status note: New module `src/lib/publishLimits.ts` exports `PUBLISH_LIMITS`, `measurePublishBytes`, `publishSizeBand`, `formatPublishBytes`, `publishLimitRefusal`. The guard sits at the top of `WorldStorageService.publishItem`, ahead of the auth check, so it refuses before authenticating too.
Base: bfc64827
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

One new pure module and one guard in the publish service, both covered by direct unit tests and the existing fetch-mock publish tests. Sonnet handles a pure module with a clear contract well.

## Parent

`docs-internal/specs/publish-size/spec.md`

## What to build

Publishing a world, entity card, dictionary, or avatar that exceeds its kind's limit fails before any request is sent. The publish dialog shows "<Kind label> is <size>, over the <limit> publish limit." Sizes and limits read in 1024-based units to one decimal.

A pure publish-limits module owns the table (world 100 MiB, entity 25 MiB, dictionary 5 MiB, model 64 MiB), the byte measure (UTF-8 byte length of the compact JSON serialization of the content, the server's own measure), the band function (green below 0.6, amber below 0.9, red from 0.9, ratio clamped at 1.0), the byte formatter, and the refusal message. Nothing else in the client states a limit.

## Acceptance criteria

- [x] The publish-limits module exports the kind table, the byte measure, the band function, the formatter, and the refusal message
- [x] Byte measure equals the UTF-8 byte length of the compact serialization for content with multi-byte characters and a data URL
- [x] Band boundaries hold at exactly 0.6 and 0.9 of each kind's limit; ratio clamps at 1.0
- [x] Over-limit content for each kind rejects from the publish service with the refusal message and no fetch is called
- [x] Content at the limit reaches fetch
- [x] Each new test fails with its bug reinstated (old band edge, missing refusal)
- [x] Four gates green

## Blocked by

- None — can start immediately
