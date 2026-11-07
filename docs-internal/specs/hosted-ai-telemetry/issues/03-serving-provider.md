# 03: Serving Provider

Status: ready-for-agent
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

- [ ] The live check's result is recorded in the spec: the field name and both modes, or that the reply names no provider.
- [ ] A fake upstream reply that names a provider reports under it, in stream and whole modes.
- [ ] A reply that names no provider, or a value outside the fixed pattern, reports under null.
- [ ] A retry row stores the provider of its own reply.
- [ ] The `providers` section shows per provider calls, median and worst first-token time, with first-token time from streams only.
- [ ] No part of the `providers` section holds a spend subject or an account id.
