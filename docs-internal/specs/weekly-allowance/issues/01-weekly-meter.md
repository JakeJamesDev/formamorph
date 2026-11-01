# 01: Weekly Meter

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/weekly-allowance/spec.md` in formamorph (Weekly meter)

Model rationale: one period change across known readers, with boundary tests.

**What to build:** a Supporter's allowance resets every Monday at 00:00 UTC. Admission, the hosted state, the usage event and the admin spend read all count this week's spend against a weekly budget, and `resetAt` names the next Monday. Budget values stay out of tracked files.

- [ ] Every monthly budget reader uses the UTC week starting Monday 00:00. No monthly sum remains in the meter.
- [ ] Tests cross the Monday boundary, including a week that spans two months and one that spans two years.
- [ ] A tier's `budget` setting means the weekly amount, with no conversion in code, and the admin route and contract docs say weekly.
- [ ] A turn admitted before the reset finishes after it, proven by a test.
- [ ] Warning acknowledgments are keyed by week: one acknowledged last week applies again this week.
- [ ] The retention setting refuses a value below 7 days.
- [ ] The budget refusal's message says week, and the README's hosted contract is current.
- [ ] The daily ceiling and the spend-versus-estimate report still pass unchanged.
