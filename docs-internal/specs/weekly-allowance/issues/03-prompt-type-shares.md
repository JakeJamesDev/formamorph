# 03: Prompt Type on Usage Rows and Shares in the Hosted State

Status: ready-for-human
Base: d401b0f
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/weekly-allowance/spec.md` in formamorph (Prompt type on usage rows, Breakdown data)

Model rationale: a column, a header and one aggregate query, in the existing route test style.

**What to build:** the proxy accepts a prompt type header and records it on the usage row. The hosted state reports each type's share of this week's spend, and the admin read for a subject lists the same shares.

- [x] CORS allows the new request header, and it never reaches the upstream, proven by the fake upstream. (`hostedAiBreakdown.test.js`: "is allowed by CORS", "never reaches the upstream"; CORS guard mutation-tested)
- [x] A known type is stored. An absent or unknown one is stored as null, and the call is still admitted. ("is stored for a known type, and null for an absent or unknown one"; mutation-tested)
- [x] The server's list of prompt types is checked by a test, as the refusal codes are. It holds all 21 types in the spec. ("holds the 21 prompt types", compared as a set)
- [x] The hosted state returns `breakdown` (share of cost as a percent with one decimal, null types as `other`) and `breakdownThreshold`. ("rounds to one decimal, folds a null type into other"; `hostedAiState.test.js` pins the fields)
- [x] Shares follow cost, proven by a test where a type with fewer tokens has the larger share. ("weights shares by cost, not tokens")
- [x] `breakdownThreshold` is a validated server setting with a default of 10. ("reads the threshold from the setting", "validates the threshold as a whole percent from 1 to 100")
- [x] No hosted-state field holds a dollar amount. ("holds no dollar amount")
- [x] The admin spend read lists every type's share, with no threshold. ("lists every type with its share, zero included, and no threshold")
- [x] The README's hosted contract lists the new fields and header. (README: prompt type header, state table, admin table, settings line)

## Landed

**Not verified**
- None. A day-pause state keeping `breakdown` follows from the code path (it shares the ready path) but has no test of its own.

**For you**
- Rulings from the spec session: header `X-Formamorph-Prompt-Type`; `breakdown` is a type-to-percent map listing only types with a share (a type under 0.05% rounds out); `null` for both fields where there is no usage figure; the admin read lists all 21 types plus `other`; the threshold is a whole number 1 to 100 or null. Ticket 04 must send the same header name.
