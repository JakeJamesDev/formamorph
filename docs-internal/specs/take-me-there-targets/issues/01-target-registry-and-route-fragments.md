# 01: Target Registry and Route Fragments

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [spec.md](../spec.md), rulings Q1, Q2, Q6.

## What to build

A guide section can end its route line with `#target`. The docs index reads the surface id and the target apart. A typed registry lists, per surface id, the targets that surface offers, and a helper returns the data attribute a control carries for one, typed so an unknown target does not compile. The surface route resolver turns a route with a registered target into steps that carry it; an unregistered target resolves to the bare surface. The open-surface request carries the target to the host. The docs check fails on a fragment the registry lacks. A report-only check prints the how-to sections whose surface has registered targets but whose route names none.

One target is registered (the Narration Layout row on the Settings Display tab) and the matching Settings section carries it, so the path is verifiable from docs to the request. No host lands the target yet.

## Acceptance criteria

- [ ] A route line `route: <surface>#<target>` yields the surface id and the target as two fields; a bare line yields no target
- [ ] The registry is keyed by surface id; every key is a surface id; every target is kebab-case
- [ ] The attribute helper rejects an unknown target at compile time (a type test)
- [ ] The resolver returns steps with the target for a registered fragment, the bare surface for an unregistered one, and no target for a bare route
- [ ] The surface request carries the target through to the host unchanged
- [ ] The docs check fails on a fragment the registry lacks, with the section and page named
- [ ] The report-only check lists untargeted sections for a fixture and never fails the run
- [ ] One target registered; the Settings Narration Layout section carries it; all existing docs checks stay green
- [ ] Each new guard reinstated once: drop the registry check and its test goes red
