# 03: Serving Provider

Status: ready-for-human
Base: f8ca89e
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-telemetry/spec.md` in formamorph (Usage row fields, report `providers`)

Model rationale: one field read from the upstream reply and one report section, after a live check that may end the ticket early.

## What to build

Each usage row keeps the upstream provider that served the call, when the reply names one. An admin reads the usage report's new `providers` section to tie slow first tokens to a provider.

First, check with `npm run live:hosted-ai` whether the upstream reply names the serving provider, in which field, in both `stream` and `whole` modes. The command reads `.env` and the settings copy from the main checkout, so run it there. Use a made-up prompt and never print the key. If no reply names the provider, update the spec to drop the field and the `providers` section, and land only that.

## Acceptance criteria

- [x] The live check's result is recorded in the spec: the field name and both modes, or that the reply names no provider. (Out of Scope entry: body keys from one `stream` and one `whole` run, plus NanoGPT's provider-selection page)
- [ ] A fake upstream reply that names a provider reports under it, in stream and whole modes.
- [ ] A reply that names no provider, or a value outside the fixed pattern, reports under null.
- [ ] A retry row stores the provider of its own reply.
- [ ] The `providers` section shows per provider calls, median and worst first-token time, with first-token time from streams only.
- [ ] No part of the `providers` section holds a spend subject or an account id.

## Landed

The reply names no provider, so the spec drops the field and the `providers` section. The unused `provider` column is removed from the schema step and `src/schema/tables.js`.

**Not verified**
- A fake upstream reply that names a provider reports under it, in stream and whole modes: not applicable, no provider is recorded.
- A reply that names no provider, or a value outside the fixed pattern, reports under null: not applicable.
- A retry row stores the provider of its own reply: not applicable.
- The `providers` section shows per provider calls and first-token times: not applicable, the section is dropped.
- No part of the `providers` section holds a spend subject or an account id: not applicable.
- Upstream HTTP response headers were not read. NanoGPT's docs name no provider header, and the spec session ruled that a docs check is enough.

**For you**
- Ticket 04: the policy field list adds the app version only. The "calls can reach several providers" question stays yours, since the upstream does not tell us.
