# 04: Client Sends the Prompt Type

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Model rationale: one header at the Request Transport, plus a list check.

**What to build:** every call to Formamorph AI names its prompt type, so usage rows record where the allowance went.

- [ ] Every pass of a turn and a Formaquestion call send the header with their `AIRequestType`. Test against the fake proxy.
- [ ] A request to any other endpoint carries no header.
- [ ] The client's half of the shared prompt type list test passes, and it fails when a type is added on one side.
