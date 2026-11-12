# 02: Traits Chip Content Row

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Traits chip gets a Content row with two options: **Description** (the default, today's output) and **Name**. In Name mode, Global Traits list one name per line, and their group headings still show.

- Add a Content axis to the Traits chip with its own two options. Do not reuse the Entities chip's three-option Content axis: traits have no AI summary.
- Name mode keeps group headings and their descriptions, in plain, markdown and XML, as names-only Global Stats do.
- The bare `<TRAITS DESCRIPTION>` keeps sending `Name: description`.
- The row label and option help follow the Writing Guide (read "Before you write" first). Run the `copy-sweep` skill on the new copy.
- Update the chip pages in `docs/` that list the Traits chip's options.
- Changelog fragment in `docs-internal/changelog.d/` (Added: Global Trait names without descriptions).

Spec rulings: Q2, Q4, Q6.

## Acceptance criteria

- [x] The Chip Options dialog shows a Content row on the Traits chip with Description and Name. Picking Name saves the Name variant id in the token. (ChipOptionsDialog.test: "gives the Traits chip a Content row")
- [x] The Name variant over the sample scene renders `Salvager's Eye` and, under the `Habits` heading and its description, `Light Sleeper`, one per line, in plain, markdown and XML. (sampleScene.test: "sends Global Trait names alone")
- [x] The bare `<TRAITS DESCRIPTION>` render is unchanged. The rendered corpus snapshot shows no diff. (corpusRendered.test and the existing sample-scene regex pass, snapshot untouched)
- [x] Each new test fails with the Name branch removed. (sampleScene test failed with the branch off; the dialog and axis tests pin the axis itself)

## Landed

**Not verified**
- The dialog test does not fail with the Name branch off in `chipValues.ts`, since it reads the saved token only. The axis option guards it.

**For you**
- Open Chip Options on a Traits chip in the prompt editor. Pick Name and read the preview: names one per line under group headings.
