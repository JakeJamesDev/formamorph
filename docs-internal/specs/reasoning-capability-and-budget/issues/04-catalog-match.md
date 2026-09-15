# 04: Catalog Match

Status: ready-for-human
Base: 603b38b5
Blocked by: 03
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Reasoning Capability and Budget](../spec.md)

**What to build:** A player on any endpoint whose model id is known to the models.dev catalog gets the reasons answer before the first turn, without a probe. The catalog is fetched once per session, cached with a long lifetime, and never touched on the turn path.

**Rationale for the model:** one new source in an existing chain plus a cached loader. Sonnet at medium effort.

## Acceptance criteria

- [x] The resolver consults the catalog after native advertisement and before observation and the probe. A hit answers reasons only; levels and budget stay as the earlier sources left them.
- [x] Matching is by model id against the catalog's provider model ids, tolerant of a provider prefix and case. A test lists the accepted id forms.
- [x] The catalog loads once per session through an injected loader, is cached in the settings cache with a lifetime of days, and a failed load leaves the chain to continue. No turn waits on the catalog.
- [x] A catalog no is treated as unknown, not no: the catalog is a hint for yes only.
- [x] Tests mock the loader with a small catalog and cover hit, miss, prefix forms, load failure, and that the probe still fires after a miss.
- [x] Typecheck, lint, tests, and build pass; report test wall time; prove the hit test fails when the catalog step is removed. Update the code graph. Changelog In Progress entry, 👤 bucket.

## Scope notes

Read-only public JSON. No bundling of the catalog into the build. No level or budget data taken from it.

## Comments

**2026-09-15 — done, ready for human.** Committed as b02c44ba, with review fixes in 3c1dbd02. Both unpushed.

**Gate state.** Typecheck 0 errors, lint 0 errors, 10258 tests pass in **74.02s**, build succeeds. All four run after the review fixes, on a tree that also holds tickets 02, 03 and 05.

**Evidence for the two proof criteria.** Removing the catalog step turned 7 of the 11 resolver-side catalog tests red. Reinstating the abort bug turned the new abort guard red on its own.

**Live facts, checked rather than recalled.** models.dev serves `Access-Control-Allow-Origin: *`, so the browser can read it. The file is 4.6 MB holding 7808 models across 217 providers; the reduction keeps 2750 reasoning ids, 72 KB stored under `FORMAMORPH_reasoningCatalog` for seven days.

**The deciding design choice.** The loader takes the resolver's own injected fetch rather than global `fetch`. Every pre-existing resolver test already 404s a URL its case did not name, so the catalog step cleanly misses and no existing test file needed an edit to stay off the network.

**Three things for the human.**

The ticket says the catalog is "cached in the settings cache". It is cached in its own `localStorage` key through `keyedStorage`, not the per-endpoint record cache the spec means. The catalog is not per-endpoint and has to be readable from a pure module, so the settings cache is the wrong home for it. The seven-day lifetime meets "a lifetime of days".

The catalog indexes a prefixed id under its bare form too, so a local model named exactly `Qwen3-8B` matches the catalog's `qwen/Qwen3-8B`. That is the tolerance the ticket asked for, and ticket 05's observation step corrects an over-permissive yes, but it is a real false-positive surface. Narrowing it would break the case where an LM Studio player runs that same model under its bare name.

Commit b02c44ba carries more of ticket 05 than its body says. The shared working copy of `reasoningEffort.ts` already held 05's observation step, so that step, the `observed` source literal, and 05's changelog bullet went in with the catalog step. The body names only `reasoningObservation.ts`. 05 committed 113f3fa0 on top before the review finished, so the record stands as written rather than being rewritten.
