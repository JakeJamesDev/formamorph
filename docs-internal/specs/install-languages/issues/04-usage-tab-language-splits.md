# 04: Language Splits On The Usage Tab

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/install-languages/spec.md` (Usage tab)

Model rationale: one more breakdown in an existing admin view, against a response shape the spec fixes.

## What to build

The Usage tab (`src/components/menu/UsageTab.tsx`) also calls `GET /api/active-installs`. Clients And Offer gains "Device Language This Month" and "AI Language This Month" ranked-bar lists for the current month, beside "Active Installs This Month", in the same style. There is no month picker (spec ruling, 2026-11-27).

## Acceptance criteria

- [x] Clients And Offer shows the current month's Device Language and AI Language ranked bars. (`UsageTab.test.tsx`, "ranks the report month's device and AI languages")
- [x] A failed active-installs call, or a month without `languages`, hides the two lists and renders the rest of the tab as before. (`UsageTab.test.tsx`, three "without language lists" cases)
- [x] Labels follow the writing guide and the design system. (Title Case headings; the lists reuse the platform list's component)
- [x] Verified on the dev-router in both themes. (DOM read on `#dev?modal=designSystem`, Usage Report, dark and light, 1440 and 390 wide)

## Landed

**Not verified**

- Nothing. The live admin route was not called: the checks use sample data and a faked fetch.

**For you**

- Open Admin Panel, Usage, Clients And Offer on the live server, and check the two language lists. Frames of the first two columns: `.scratch/install-languages-04/frames/language-lists-dark.jpg` and `.scratch/install-languages-04/frames/language-lists-light.jpg`.
