# Variadic Versus Array Call Syntax

## Decision

The literal syntax comparison tied: **11/12 correct for each format** on `g4-meromero-v2-31b-i1`. Both passed all nine multi-entity trials. This sample provides no correctness advantage for arrays; the user's preferred variadic signature is a reasonable choice for a literal text-call interface.

This experiment deliberately compares literal JavaScript call expressions under the same text protocol. It does not compare native JSON tool schemas, execute lookups, test the narration loop, or measure spontaneous format preference when both forms are available.

## Method

The only within-pair prompt difference was the declared signature:

```ts
request_info(...terms: string[])
request_info(terms: string[])
```

Both prompts asked for exactly one executable call expression, string-literal names, and no Markdown fences or explanatory prose. No filled-in call examples were supplied. Each user message requested full descriptions of named entities in one call, using semicolons between names.

Cases used existing Sedge Landing entities: Bram; Bram and Odette; those two plus Rope Ferry; and all five entities, adding Tomas and Wick. Each case ran with seeds `424242`, `424243`, and `424244`. Variant order alternated across pairs. All 24 requests used the same model, thinking-on default, non-streaming output, 1,024-token cap, and three-minute timeout. No native tool definitions were sent. Sampler settings other than the seed were omitted equally.

TypeScript's JavaScript parser checked each actual response without executing it: one direct `request_info` call, the correct argument structure, string literals, and exactly the requested names. Single/double quotes, optional semicolons, and term reordering were accepted. Duplicates, missing/extra names, syntax errors, and wrong argument shapes failed. All 24 returned call strings were also inspected directly.

## Results

| Requested entities | Variadic | Array |
|---|---:|---:|
| One | 2/3 | 2/3 |
| Two | 3/3 | 3/3 |
| Three | 3/3 | 3/3 |
| Five | 3/3 | 3/3 |
| **Total** | **11/12 (91.7%)** | **11/12 (91.7%)** |

Both errors occurred for Bram alone with seed `424243`:

```js
// Variadic signature: wrong argument shape.
request_info(['Bram'])

// Array signature: invalid JavaScript named-argument syntax.
request_info(terms: ['Bram'])
```

All other responses had the requested names and format. Every response finished with `stop`; none timed out or exhausted its token cap. Reasoning was exposed in both arms.

| Metric | Variadic | Array |
|---|---:|---:|
| Sum of request time | 43.030 s | 32.274 s |
| Prompt tokens | 1,089 | 1,089 |
| Completion tokens | 1,377 | 1,057 |
| Reported reasoning tokens | 1,146 | 823 |

Array trials used fewer completion tokens here, almost entirely due to less reasoning; this small run does not establish a stable speed or token-cost advantage. Whole-batch time was **75.315 seconds**, and CLI wall time was **75.573 seconds**.

## Evidence and limits

- [Raw requests, responses, scores, and embedded runner source](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/syntax-batch-2026-09-22T12-12-58-792Z.json)
- SHA-256: `7e66c0014672850747bc4ba2a1344638b599f93f29c2ed53bdd32cc8b014bc61`.
- Source base: `727709e1`. The throwaway runner used the real world fixture and did not edit production code or the existing probe.

Twelve trials per format on one model are insufficient to establish equivalence or a general model preference. The declared TypeScript-style signature is part of the tested interface; other descriptions could produce different results. This comparison answers which of these two literal interfaces was followed more often in this sample: neither. No production interface was changed.
