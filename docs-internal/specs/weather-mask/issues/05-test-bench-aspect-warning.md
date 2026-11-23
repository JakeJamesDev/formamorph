# 05: Test Bench Aspect Warning

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

## What to build

The Test Bench warns when a mask's shape differs from a picture that uses it. The spec covers this in Q15.

- **Rule.** A warning when a Mask's aspect ratio differs from a linking location image's beyond a small tolerance. The finding names the location, the image slot and the mask. A link to a missing Mask reads as no mask under the existing missing-media finding.
- **Docs.** The wiki Test Bench page lists the warning.

## Acceptance criteria

- [ ] A mask with a different aspect ratio from its linking image raises one warning naming the location, slot and mask.
- [ ] A matching mask, and a world with no masks, raise none.
- [ ] Reinstating a rule that skips the check turns the test red.
