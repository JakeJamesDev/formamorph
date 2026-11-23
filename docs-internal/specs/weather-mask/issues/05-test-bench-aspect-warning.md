# 05: Test Bench Aspect Warning

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

## What to build

The Test Bench warns when a mask's shape differs from a picture that uses it. The spec covers this in Q15.

- **Rule.** A warning when a Mask's aspect ratio differs from a linking location image's beyond a small tolerance. The finding names the location, the image slot and the mask. A link to a missing Mask reads as no mask under the existing missing-media finding.
- **Docs.** The wiki Test Bench page lists the warning.

## Acceptance criteria

- [x] A mask with a different aspect ratio from its linking image raises one warning naming the location, slot and mask. (`maskAspects.test.ts`: embedded, linked, Layered slots)
- [x] A matching mask, and a world with no masks, raise none. (same file: matching, within 2%, no masks)
- [x] Reinstating a rule that skips the check turns the test red. (mutant that always skips: 3 tests failed)

## Landed

**Not verified**
- The merge of the new rows into the Issues list in `useTestBench.ts` has no test, and the row was not seen in the live Issues tab.

**For you**
- Open Issues in Advanced mode on a world whose location image links a mask of another shape: the warning should name the location, image number and mask. Simple mode should hide it.
