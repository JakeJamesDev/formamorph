# 01: Weekly Meter

Status: ready-for-human
Base: 2e5d95a
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/weekly-allowance/spec.md` in formamorph (Weekly meter)

Model rationale: one period change across known readers, with boundary tests.

**What to build:** a Supporter's allowance resets every Monday at 00:00 UTC. Admission, the hosted state, the usage event and the admin spend read all count this week's spend against a weekly budget, and `resetAt` names the next Monday. Budget values stay out of tracked files.

- [x] Every monthly budget reader uses the UTC week starting Monday 00:00. No monthly sum remains in the meter. (`weekStart` in admission, state and admin read; no `monthStart` left)
- [x] Tests cross the Monday boundary, including a week that spans two months and one that spans two years. (metering test "refuses a first call until the Monday reset", three cases)
- [x] A tier's `budget` setting means the weekly amount, with no conversion in code, and the admin route and contract docs say weekly. (README, `getSpend` doc)
- [x] A turn admitted before the reset finishes after it, proven by a test. (metering test "lets a turn admitted before the reset finish after it")
- [x] Warning acknowledgments are keyed by week: one acknowledged last week applies again this week. (state test "applies an acknowledgment across a month change"; mutation to a month key fails it)
- [x] The retention setting refuses a value below 7 days. (state test "refuses a retention below 7 days")
- [x] The budget refusal's message says week, and the README's hosted contract is current.
- [x] The daily ceiling and the spend-versus-estimate report still pass unchanged. (full suite green, 3096 tests)

## Landed

**Not verified**
- None. Deploy note: a server that holds monthly budget values needs weekly values at the same deploy. A stored retention below 7 days stays until the next admin save, which then refuses it.

**For you**
- Set each tier's weekly budget in server settings, and check the retention setting is 7 or more.
