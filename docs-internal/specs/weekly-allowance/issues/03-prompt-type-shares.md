# 03: Prompt Type on Usage Rows and Shares in the Hosted State

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/weekly-allowance/spec.md` in formamorph (Prompt type on usage rows, Breakdown data)

Model rationale: a column, a header and one aggregate query, in the existing route test style.

**What to build:** the proxy accepts a prompt type header and records it on the usage row. The hosted state reports each type's share of this week's spend, and the admin read for a subject lists the same shares.

- [ ] CORS allows the new request header, and it never reaches the upstream, proven by the fake upstream.
- [ ] A known type is stored. An absent or unknown one is stored as null, and the call is still admitted.
- [ ] The server's list of prompt types is checked by a test, as the refusal codes are. It holds all 21 types in the spec.
- [ ] The hosted state returns `breakdown` (share of cost as a percent with one decimal, null types as `other`) and `breakdownThreshold`.
- [ ] Shares follow cost, proven by a test where a type with fewer tokens has the larger share.
- [ ] `breakdownThreshold` is a validated server setting with a default of 10.
- [ ] No hosted-state field holds a dollar amount.
- [ ] The admin spend read lists every type's share, with no threshold.
- [ ] The README's hosted contract lists the new fields and header.
