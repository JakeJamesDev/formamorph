# 01: Route tags in the docs index

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A how-to section in the player docs can name the surface it explains, and the docs index knows it.

- One HTML comment line per section, the same shape as the keyword line: `<!-- route: <surface id> -->`. The id is a surface id from the surface map: a screen or dialog name, or `<ledger key>.<tab>`.
- The index parses the line as it parses keywords, strips it from the section text, and stores it on the section. Parts of a split section inherit it. A section without a line has no route. The route never joins the search phrases.
- A source test over the bundled docs refuses a route that is not a surface id, and a route on an excluded (staff or dev) surface.
- As first real data, every how-to section on the Settings pages gets its route.

Spec: Implementation → Route tags in the docs.

Recommended model rationale: a parser extension beside an existing one, with a clear contract and prior-art tests.

## Acceptance criteria

- [ ] A section with a route line stores the route and its text no longer holds the line; a split part inherits it; a routeless section has none; search phrases are unchanged.
- [ ] The source test fails on an unknown id and on an excluded surface; proven by reinstating a bad line.
- [ ] The Settings pages' how-to sections carry routes and the test passes.
- [ ] The four gates are green.
