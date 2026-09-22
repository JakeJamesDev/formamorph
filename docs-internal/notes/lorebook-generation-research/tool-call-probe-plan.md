# Cloud narration tool-call probe — review draft

Prepared September 22, 2026. **Status: proposed flow only; no cloud requests sent.**

## Question

Will the configured cloud narrator use native function calls to retrieve full entity descriptions from summaries, then submit its narration through `write`?

This first experiment separates endpoint acceptance, correct tool use, and use of retrieved facts. It does not establish production reliability or streaming support.

## Proposed setup

| Setting | Proposal |
|---|---|
| Endpoint | `https://api.lyonade.net/v1/chat/completions` |
| Model | `default` |
| World | Existing Sedge Landing baseline fixture |
| Prompt source | Read `defaultSystemPrompt` and `defaultNarrationUserPrompt` from the current source when preparing the probe |
| Planning | Off; the narrator itself chooses lookups |
| Tool choice | `auto` on every request; both tools remain available |
| Transport | Non-streaming for this first protocol test |
| Generation | `max_tokens: 1024`, `reasoning_effort: "none"`; omit temperature and repetition penalty to match the unpinned cloud narration path |
| Display settings | English, plain prose, single-paragraph length guidance |
| Trials | Two independent runs of the main case, then two of the control |
| Limits | Four model requests per trial, four lookup calls per trial, 60-second timeout per request; stop the batch on an endpoint-level rejection |

These are reviewable test settings, not changes to app defaults. Each trial starts with fresh messages. There are at most 16 model requests in the proposed batch, with no warm-up, automatic retries, or local-model calls. Record any seed as an experimental setting, not as a promise of cloud reproducibility.

Sources: [cloud defaults](D:/Documents/GitHub/formamorph/src/contexts/settingsDefaults.ts:11), [sampler resolution](D:/Documents/GitHub/formamorph/src/lib/promptSamplers.ts), [length guidance](D:/Documents/GitHub/formamorph/src/lib/outputLength.ts).

## Initial prompt: what changes

Use the real [default narration prompt](D:/Documents/GitHub/formamorph/src/components/game/GamePrompts.ts:3), rendered with Sedge Landing's scene. Retain its world, location, player, stats, traits, notes, dictionary, and narration-style sections. Entity descriptions are the withheld information in this experiment; dictionary retrieval is not being replaced yet.

Change only these two entity chips in the probe's in-memory copy:

```text
<ENTITIES|markdown|header="Characters and things that may appear in this location">
→ <ENTITIES|summary.markdown|header="Characters and things that may appear in this location">

<ENTITIES|sublocations.markdown|header="Characters and things that may appear in a sub-location">
→ <ENTITIES|sublocations.summary.markdown|header="Characters and things that may appear in a sub-location">
```

Reachable entities already use summaries. Render through the production context/template helpers; do not flatten the template with a separate approximate replacement routine. Fail the offline preparation if a missing summary falls back to a full entity description, a template token remains unresolved, or a withheld fact leaks through another prompt block.

The current `## Output` section begins with “Output only the story prose”. Replace that first sentence in the probe copy with:

```text
Submit the finished story through write, with only the story prose in its narration argument: the events themselves, with no labels, no mention of being an AI, and nothing after the scene ends.
```

Keep the rest of that section. Add the following section immediately before `## Output`:

```text
## Entity information
The entity listings contain summaries. Full descriptions are available through request_info.
Before portraying a listed entity in this turn, retrieve its full description using its listed name. Use that description together with the established scene to write the entity consistently.
Request further information when a returned description leaves you needing another entity's details. Once you have enough information, submit the complete narration through write.
```

The production prompt and world fixture stay unchanged. This is a deliberate retrieval instruction with optional API tool choice: we are testing whether the model follows the instruction through native calls, not whether it spontaneously discovers a need for tools without guidance.

## What the model initially knows

Use [Sedge Landing](D:/Documents/GitHub/formamorph/testing/baseline/sedge-landing.json), with Wren at the landing. Names, types, and the authored summaries are visible; full entity descriptions remain in the local lookup registry.

| Entity | Visible summary | Examples present only in its full description |
|---|---|---|
| Bram | The one-armed ferryman who won't cross after dark. | His remaining arm is the right; left sleeve pinned up; brass ring in his left ear |
| Odette | The scarred eel-smoker waiting to cross; distrusts strangers. | Burn scar on her right cheek; green glass bead braided into her hair; counts everything twice |
| Rope Ferry | A two-person rope raft that lists to the left. | Tar-black rope; crossing requires both hands on it |
| Tomas, in the reachable Far Bank block | The one-eyed far-bank watchman with a fishing spear. | Milky left eye; tarred canvas cloak; challenges arrivals |

The model does not receive this table's last column. That column is for our evaluation only. Audit the complete rendered request, including player traits, locations, dictionary entries, and history, before claiming those facts are withheld. Begin with no prior narration so previous turns cannot supply the missing details.

## Player messages

Main case action:

```text
I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.
```

Use the current [narration user template](D:/Documents/GitHub/formamorph/src/components/game/GamePrompts.ts:87). Its rendered message is:

```text
I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.

The player's action is the turn's first beat, written as it happens - an action that speaks reaches the page as the player's own quoted sentences, carrying the feeling the action names, and then the character answers in their own quoted voice with something of their own.
```

The world says strangers do not readily disclose their names. A guarded answer is valid; the player's request must not force a canon violation.

Control action, substituted into the same user template:

```text
I crouch at the edge of the dock and study the pale water beneath it.
```

This can be narrated from location and already active dictionary information. A direct `write` is valid if the model portrays no listed entity. If it brings an entity into the scene, its lookup is justified; record that instead of calling every control lookup a false positive.

## Tools supplied alongside messages

```json
[
  {
    "type": "function",
    "function": {
      "name": "request_info",
      "description": "Retrieve full descriptions of world entities by name or keyword.",
      "parameters": {
        "type": "object",
        "properties": {
          "term": { "type": "string" }
        },
        "required": ["term"],
        "additionalProperties": false
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "write",
      "description": "Submit the completed story narration.",
      "parameters": {
        "type": "object",
        "properties": {
          "narration": { "type": "string" }
        },
        "required": ["narration"],
        "additionalProperties": false
      }
    }
  }
]
```

Use native `message.tool_calls`, with stringified JSON arguments and call IDs. Do not count a function-looking string in ordinary `content` as a tool call. No `strict` or forced-tool setting is needed for this first test. The wire format follows the [official function-calling guide](https://developers.openai.com/api/docs/guides/function-calling).

`request_info` is a local fixture lookup, not another AI request. Search the fixture's entities using trimmed, case-insensitive exact names and these explicit aliases: Bram → ferryman; Odette → eel-smoker, woman by the firepit; Rope Ferry → ferry, raft; Tomas → watchman, far-bank watchman; Wick → ferryman's sister. Full names always work. Unknown input returns `{"matches":[]}`. Return every match if aliases collide; never guess which entity was intended. Broader semantic keyword search is outside this first protocol experiment.

Each match returns `id`, `name`, and `description`, with `description` copied verbatim from `aiDescription`. The fixture remains local until a requested description is returned.

## Expected flow, illustrated — not an observed result

1. **Model request 1:** send the summary-only system prompt, main-case user message, both tool definitions, and `tool_choice: "auto"`.
2. **Possible model response:** two native `request_info` calls, for Bram and Odette. Sequential calls across separate rounds are equally valid; the test does not require batching.
3. **Application:** retain that assistant message, execute the calls, and append one `role: "tool"` message per call using its `tool_call_id`.

For Bram, the tool message's string `content` encodes:

```json
{
  "matches": [
    {
      "id": "ent-bram",
      "name": "Bram",
      "description": "Bram is the ferryman: a broad, weathered man with only one arm - the right; his left sleeve is pinned up - and a brass ring through his left ear. He speaks in short dry sentences and never crosses the river after dark. He has not told the player his name."
    }
  ]
}
```

Odette's result follows the same shape, using her authored full description verbatim.

4. **Model request 2:** resend the original messages plus the assistant's calls and both tool results. Keep both tool definitions and `auto` available. The model may request another description, in which case the loop repeats within the limits.
5. **Possible final response:** a native `write` call whose arguments contain the complete narration string.
6. **Application:** validate and capture the narration, then end the trial. No extra model call is needed to acknowledge the terminal `write`.

Tool results become available only on the next model request. A `write` submitted in the same response as a new lookup cannot incorporate that lookup's result; record this as a sequencing failure rather than treating textual call order as evidence that the model read the result. Stop on malformed arguments, unknown functions, duplicate call IDs, multiple writes, empty narration, or mixed write/lookup batches. Preserve the original response; do not silently repair it or inject coaching.

Ordinary narration without `write` is an output-contract failure. An unknown lookup can receive the empty result and continue. Repeated or unproductive lookups remain visible in the record and count toward the cap. Reaching a cap is an incomplete trial, not an automatic forced write.

## What we will inspect

| Observation | What it establishes |
|---|---|
| HTTP response / error body | Whether this request shape is accepted |
| Actual `tool_calls` and valid arguments | Whether the model emits native calls, beyond merely accepting the fields |
| Successful follow-up after tool results | Whether the endpoint handles the round trip |
| Lookup before portraying Bram and Odette | Whether missing entity information is requested in the main case |
| One valid terminal `write` | Whether the model obeys the requested delivery method |
| Specific returned facts used correctly | Evidence that retrieved information informs narration |
| Contradictions, guessed details, unused lookups | Retrieval or narration failures that a valid call alone would conceal |
| Control lookups and entities actually portrayed | Whether retrieval is selective or indiscriminate |
| Time per request and whole trial; usage per response | Observed latency and token cost, including extra rounds |

Omitting an optional descriptive detail is not a contradiction. If no fact unique to the full descriptions reaches the narration, record fact uptake as **not demonstrated**, even if the tool protocol succeeds. Two successful trials are a smoke-test result, not a reliability percentage or a production readiness claim.

Save the exact rendered requests, raw responses, tool results, extracted narration, and timing in the gitignored baseline runs directory, excluding credentials. The request snapshot must be checked for missing-information leaks before the first cloud call. No network-backed token-count request is part of preparation.

## Review boundary

This document is the proposed test. After the user approves or adjusts it, build the probe in the existing baseline harness, validate its offline request assembly, and run only the approved cloud batch. Streaming, a full-description comparison, longer sessions, and local models are follow-up experiments.
