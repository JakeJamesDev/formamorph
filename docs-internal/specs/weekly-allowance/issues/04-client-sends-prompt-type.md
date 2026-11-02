# 04: Client Sends the Prompt Type

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Model rationale: one header at the Request Transport, plus a list check.

**What to build:** every call to Formamorph AI names its prompt type, so usage rows record where the allowance went.

- [x] Every pass of a turn and a Formaquestion call send the header with their `AIRequestType`. Test against the fake proxy. ("names each pass's prompt type on every call", includes `help`; Formaquestion builds its spec through the same `buildAiRequestSpec`)
- [x] A request to any other endpoint carries no header. ("sends no prompt type to another endpoint"; both header tests fail with the header moved to the non-hosted branch)
- [x] The client's half of the shared prompt type list test passes, and it fails when a type is added on one side. ("the prompt type list" pins the 21 types as a set against `ALL_REQUEST_KINDS`)

## Landed

**Not verified**
- None.

**For you**
- None. No changelog fragment: the header changes nothing a player sees.
