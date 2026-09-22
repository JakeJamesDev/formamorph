# Full Narration With Thinking Enabled

## Controlled change

The same loaded `g4-meromero-v2-31b-i1` model ran the same four full narration cases. The only initial-request change was omission of `reasoning_effort: "none"`. LM Studio's `/api/v1/models` reported reasoning options `off` and `on`, with default `on`; actual responses confirmed thinking through nonempty `reasoning_content` and positive reasoning-token counts.

All four initial request bodies matched the [thinking-off baseline](meromero-full-findings.md) after removing that one field. Prompt, tools, seed, automatic tool choice, 1,024-token response cap, three-minute timeout, and outgoing ID mapping stayed unchanged. The temporary source change was restored byte-for-byte after execution. Follow-up history naturally differed because it included each new response, including its reasoning field.

## Results

| Trial | Entity lookups | Native write | Outcome | Trial duration | Reported reasoning tokens |
|---|---:|---|---|---:|---:|
| Main 1 | 2 | No | Returned narration as ordinary prose; finish `stop` | 20.058 s | 356 |
| Main 2 | 2 | Yes | Submitted narration, but in three paragraphs | 21.187 s | 390 |
| Control 1 | 2 | No | Continuation exhausted 1,024-token cap; finish `length` | 40.358 s | 1,098 |
| Control 2 | 2 | Yes | Submitted narration | 23.816 s | 503 |

Both descriptions were retrieved in every trial. Native write completion fell from **4/4 to 2/4**, while batch duration rose from **30.003 to 105.420 seconds**. This is a small fixed-case comparison, not a general reliability estimate.

The batch reported 12,204 prompt tokens and 3,163 completion tokens, **15,367 total**; reported reasoning tokens summed to **2,347**. CLI wall time was **119.353 seconds**. No request hit the three-minute timeout. The truncated control continuation reported 1,024 completion tokens, including 886 reasoning tokens; it returned no narration or tool call. The harness labels that trial `missing_write`, but the raw finish reason distinguishes budget exhaustion from the ordinary-prose failure in Main 1.

## What the exposed reasoning suggests

These are summaries of the model's exposed reasoning, not a guarantee that the text fully explains its internal decisions:

- **It understood the retrieval purpose.** The main cases explicitly planned to fetch both full descriptions before writing about the characters, then incorporated the returned character facts into their narration plans.
- **It treated the control as an opening-scene introduction.** Both control plans interpreted nearby characters as people to introduce while establishing the scene. That planned portrayal motivated retrieving both descriptions, even though the action only concerned the water.
- **Dialogue instructions influenced the scene.** Control 2 interpreted the player's quoted-speech instruction as requiring a spoken observation and an NPC reply. Control 1 recognized that the action was purely descriptive but still planned an NPC response.
- **Retrieving both did not mean using both.** Control 2 fetched Bram and Odette, then chose a ferryman response and omitted Odette from its final narration.
- **Reasoning did not guarantee delivery or fidelity.** Main 1 planned story constraints but returned plain prose. Main 2 added an unsupported missing-ear implication and broke the single-paragraph instruction. Control 2 described the ferryman's single arm as pinned to his side rather than describing his pinned empty left sleeve.

This strengthens the case for testing scene-selection and dialogue instructions, rather than assuming the retrieval tool's purpose is unclear. A clearer tool description remains a separate hypothesis. The unchanged cap also constrained thinking: testing a larger budget would be a separate experiment, not part of this result.

## Evidence

- Source base: `8bb9c297`; default probe source restored, no persistent code changes.
- [Thinking-on transcript](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/lm-studio-batch-2026-09-22T11-47-54-919Z.json)
- SHA-256: `aca2c464f6ea53a1783c28e817260e13fa2d59e80e3339200f345dea0c8c9e4e`
- [Thinking-off transcript](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/lm-studio-batch-2026-09-22T11-37-11-791Z.json)

The live batch and exact request comparison are the verification for this experiment. Production code and prompts are unchanged; no repository gate reruns were needed.
