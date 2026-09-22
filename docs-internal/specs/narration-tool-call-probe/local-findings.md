# LM Studio Narration Tool-Call Probe Findings

## Outcome

LM Studio accepted all four approved requests and returned ordinary assistant completions. `rocinante-x-12b-v1` made no native function calls in any trial: it skipped both `request_info` and the required terminal `write`, placing prose directly in `message.content`. The harness therefore classified every trial as `missing_write`.

This establishes model-level protocol failure for this bounded configuration, not an endpoint compatibility failure. It does not establish how the model would behave with forced tool choice, a different parser/template, prompt coaching, or another model.

## Local batch

The batch targeted `http://127.0.0.1:1234/v1/chat/completions` with model `rocinante-x-12b-v1` and seed `424242`. Each request supplied both native tools, automatic tool choice, non-streaming responses, `reasoning_effort: "none"`, and a 1,024-token response cap. Temperature and repetition penalty were omitted.

The order was two fresh main trials followed by two fresh scene-only controls. No request was retried, forced, repaired, coached, or substituted.

## Trial outcomes

| Trial | Endpoint accepted | Native calls | Round trip | Lookup compliance | Terminal `write` | Retrieved-fact use | Narration fidelity |
|---|---:|---:|---|---|---|---|---|
| `main-1` | Yes | 0 | Not reached | Failed: portrayed both listed characters after 0 lookups | Failed | Not demonstrated | Failed: leaked both names, contradicted Odette's scar, and used multiple paragraphs |
| `main-2` | Yes | 0 | Not reached | Failed: portrayed both listed characters after 0 lookups | Failed | Not demonstrated | Failed: leaked both names, contradicted Odette's scar and activity, invented scene history, and used multiple paragraphs |
| `control-1` | Yes | 0 | Not reached | Failed: introduced both listed characters after 0 lookups | Failed | Not demonstrated | Failed: leaked Bram's name, contradicted Odette's scar, invented prior events, and used multiple paragraphs |
| `control-2` | Yes | 0 | Not reached | Failed: introduced a listed character after 0 lookups | Failed | Not demonstrated | Failed: moved Odette's scar to her hands and used multiple paragraphs |

The main completions did use summary-visible traits such as Bram being one-armed and Odette being scarred. Those are not evidence of retrieved-fact use: the initially rendered prompt already exposed those summaries, while no tool result supplied the withheld arm/sleeve/earring or scar/bead/counting details.

## Representative output

`main-1` returned plain content ending with:

> “Day's near done,” he says flatly — Bram, though you won't know that yet. … Odette shifts her weight … “And I'd rather not speak names over water.”

The prose explicitly acknowledges that Bram's name is unknown while printing it, then prints Odette's name without an in-scene introduction. It describes Odette as having “scars climbing her neck,” contrary to the authored burn scar across her right cheek.

`control-1` introduced character history even though the player only studied the water:

> Bram, the ferryman, won't cross after dark — he made that clear when you arrived an hour past sunset.

No such prior exchange or arrival time existed in the supplied scene. Because the model made no `write` call, none of these content strings qualifies as a successful narration submission under the tested contract.

## Timing and usage

| Trial | Requests | Lookups | Duration | Prompt tokens | Completion tokens | Total tokens |
|---|---:|---:|---:|---:|---:|---:|
| `main-1` | 1 | 0 | 4,339.46 ms | 1,333 | 237 | 1,570 |
| `main-2` | 1 | 0 | 4,465.42 ms | 1,333 | 284 | 1,617 |
| `control-1` | 1 | 0 | 4,105.00 ms | 1,328 | 274 | 1,602 |
| `control-2` | 1 | 0 | 2,053.71 ms | 1,328 | 136 | 1,464 |
| **Recorded total** | **4** | **0** | **14,963.78 ms batch** | **5,322** | **931** | **6,253** |

The full CLI process took 36.853 seconds, including startup and evidence serialization. The repeated main and control inputs produced different content under the fixed seed; this observation does not establish why repetition varied or how other LM Studio configurations handle seeds.

## Evidence

- [Raw LM Studio batch evidence](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/lm-studio-batch-2026-09-22T10-01-28-627Z.json)
- Recorded source revision: `3072b16fdffb17e570e79f221a59443698764f0d`
- Evidence SHA-256: `e28cd5523542a1fb207cc5e4f6b2f229c36032854f7e7196b2fbe4f336939417`

The evidence contains each credential-free request body, raw LM Studio response, duration, counters, and usage object. The local CLI extension was an uncommitted working-tree change during execution; the recorded revision identifies its reviewed base, while the evidence hash fixes the exact observed transcript.

## Limits

This was a four-trial smoke test of one loaded model and one LM Studio configuration. It measures endpoint acceptance and the model's unforced behavior under the reviewed request, not production readiness or a reliability rate. No forced call, alternate prompt, chat template, tool parser, sampler, or model was tested.
