# 14: Client Reads the Warning Thresholds

Status: ready-for-agent
Blocked by: 13
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: replaces one constant with a parsed field and updates the tests that used it.

**What to build:** the allowance notices use the thresholds the hosted state reports (ticket 13), not the client constant in the hosted allowance module. The constant is removed.

- [ ] The hosted-state parser reads `warnThresholds`; a missing or malformed list shows no notice rather than guessing.
- [ ] Notices fire at the reported thresholds (test with a list other than the old constant).
- [ ] The client constant is gone, and no other copy of the thresholds remains in the client.
- [ ] The guard is proven by removing it once.
