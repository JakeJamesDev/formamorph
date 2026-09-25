# Spec: Tool Creator

Status: ready-for-agent
Spec session: 19957bbe-f68f-4d10-bf94-26ef6b1a2d9a
Prototype: `prototype/tool-creator` at `6599ac09`, variant D (`?variant=D#dev?modal=settings&tab=tools`, run `npx vite --port 5224` in its worktree)

## Problem Statement

The narrator gets every entity's full description up front, whether the scene needs it or not. Our probes show a model can instead call a Tool to fetch the entries it needs, and that the best lookup description fetches every involved entity with the least reasoning. There is no way to use this in the app. A player cannot give the AI a Tool, cannot see what one returns, and cannot tell whether their endpoint supports tools at all.

## Solution

A new **Tools** tab in Settings (Advanced only) lets a player create, edit, test and share Tools as part of a prompt preset. A Tool has a name, a description the AI reads, parameters, a Tool Handler (Lookup, Template or Script) and a list of the prompts that offer it. Built-in Tools form a global catalog every preset can see; a preset chooses which are on and which prompts offer them. The catalog ships a `get_entity` Tool, off by default, and the Experimental preset turns it on. During play, a prompt that offers Tools sends them to endpoints known to support tools. The app runs each call, sends the result back, and the model finishes its reply. Tool rounds count as silent requests: the player sees them only with **Show Silent Requests** on.

## User Stories

### Defining a Tool

1. As a player, I want a Tools tab in Settings, so that I can manage the Tools my prompts offer the AI.
2. As a player, I want the Tools tab to show the same preset selector as the Prompts tab, so that I always know which preset's Tools I edit.
3. As a player in Simple mode, I want the Tools tab hidden, so that Settings stays short.
4. As a player, I want the list split into Built-In and My Tools, so that I can tell shipped Tools from mine. Built-In shows the same catalog in every preset.
5. As a player, I want a New Tool button at the end of the list, so that I can start a Tool from nothing.
6. As a player, I want to select a Tool and see a read view with its name, a one-line summary of what it does, and its description, so that I understand it before I edit it.
7. As a player, I want an Enabled checkbox on each Tool, stored per preset, so that I can turn a Tool off without deleting it. On a built-in preset the checkbox is disabled.
8. As a player, I want to Duplicate a built-in Tool into the active user preset, so that I can change a copy while the original stays intact. On a built-in preset, Duplicate tells me to duplicate the preset first.
9. As a player, I want Edit and Delete on my own Tools, with a confirmation before a delete, so that I don't lose a Tool by accident.
10. As a player, I want edit mode grouped into Definition, Parameters, Handler and Availability tabs with icons, so that a Tool's settings are easy to find.
11. As a player, I want the tool name checked against the allowed characters as I type, so that I never save a name the endpoint rejects.
12. As a player, I want the description field to guide me toward Purpose, Use when, Input and Output, so that I write what the AI needs to decide when to call the Tool.
13. As a player, I want undo and redo in every multiline field, so that I can recover an edit.
14. As a player, I want to add, edit and remove parameters with a name, a type (text, number, yes/no, one of a list), a description and a required flag, so that the AI knows what to pass.
15. As a player, I want to pick a Tool Handler kind (Lookup, Template, Script), so that I choose what runs when the AI calls the Tool.
16. As a player, I want a Lookup handler that searches entities, locations or dictionary entries by one parameter, matching names and aliases, so that the AI can fetch authored information.
17. As a player, I want a Lookup to return either the full description or the summary, so that I control how much text comes back.
18. As a player, I want a Lookup to return every match for an ambiguous name, so that the app never guesses for the AI.
19. As a player, I want a Template handler that returns text I write, with parameters inserted as chips, so that I can build a Tool without code.
20. As a player, I want a Script handler with syntax highlighting, autocomplete and a hint listing what the script can read, so that I can write one without reading docs.
21. As a player, I want scripts to read the world and the current scene but never change them, so that a Tool can't break my playthrough.
22. As a player, I want to set what a Tool returns when nothing matches, so that the AI gets a clear empty answer.
23. As a player, I want to choose which prompts offer a Tool (narration, director, choices, and so on), stored per preset for built-in Tools too, so that each prompt gets only the Tools it can use.
24. As a player, I want a per-Tool limit on calls per request, with a global default when I leave it blank, so that a looping model can't run forever.
25. As a player, I want to open the Tools tab full screen, so that I have room to read and edit.
26. As a player, I want my place and my unsaved edits kept when I switch full screen on or off, so that the switch costs nothing.

### Testing a Tool

27. As a player, I want a Try It panel in the read view and beside the edit tabs, so that I can test a Tool while I build it.
28. As a player, I want Try It to show one input per parameter, so that I enter arguments the way the AI would.
29. As a player, I want Try It to run against the world I have open, and against a sample world when none is open, so that results are realistic.
30. As a player, I want the result shown with syntax highlighting, so that JSON is easy to read.
31. As a player, I want to see exactly what the AI receives for the Tool (its schema) with syntax highlighting, so that I can check the definition.
32. As a player, I want a script error shown as a readable message in Try It, so that I can fix it.

### Endpoint support

33. As a player, I want the app to know whether my endpoint and model support tools before it sends any, so that no turn fails on a rejected request.
34. As a player, I want support read from the server's model list when the server has one, so that no extra request is sent.
35. As a player, I want one small probe sent only when the server has no model list, bundled with the reasoning probe when one fires and sent alone when reasoning is already known, so that detection costs at most one request in the normal case.
36. As a player with an LM Studio model that isn't marked as trained for tools, I want no Tools sent to it, so that an untrained model doesn't skip or garble them.
37. As a player, I want the Tools tab to tell me when my text endpoint won't receive Tools, so that I know why a Tool-based preset reads only summaries.
38. As a player, I want the prompt text sent unchanged when Tools can't be sent, so that the preset behaves predictably.

### During play

39. As a player, I want the AI to call a Tool and get its result before it writes, so that the narration uses the full entry.
40. As a player, I want several calls in one response handled together, so that a scene with two characters costs one round.
41. As a player, I want only the final round's prose shown, so that text the model wrote before a lookup never reaches the narration.
42. As a player, I want fetched entries left out of later turns' history, so that history doesn't grow with every lookup.
43. As a player, I want a turn to finish even when a model makes a malformed call, calls an unknown Tool or hits the limit, so that a bad call never strands the turn.
44. As a player, I want no status line about Tool calls by default, so that names the AI looks up don't spoil the scene.
45. As a player with Show Silent Requests on, I want a "Looking up…" status line while Tools run, so that I can see what the AI is doing.
46. As a player debugging a turn with Show Silent Requests on, I want AI Context to show each Tool round with its call, arguments, result and reasoning, highlighted, so that I can see why the narration turned out as it did.
47. As a player using Stop, I want an in-progress Tool round canceled, so that Stop works the same as always.

### Presets and sharing

48. As a player, I want the Experimental preset to turn on the catalog's `get_entity` with the retrieve-first description, so that Tools work without setup.
49. As a player, I want a built-in Tool's definition read-only in every preset, and a built-in preset's Tool settings read-only like its prompts, so that I duplicate to change them.
50. As a player, I want Tools to export and import with a prompt preset, so that I can share them.
51. As a player importing a preset that holds Script Tools, I want a notice that it contains scripts, so that I know before I use it.
52. As a player, I want my Tools saved with my presets across sessions, so that I don't rebuild them.

## Implementation Decisions

### Model and storage

- A user **Tool** is defined in a prompt preset (ADR-0008). World export shape does not change. Preset export shape does change, additively.
- The Tool shape, from the prototype:

  ```ts
  type ParamType = 'string' | 'number' | 'boolean' | 'enum';
  interface ToolParam { name: string; type: ParamType; description: string; required: boolean; options: string[] }
  type ToolHandler =
    | { kind: 'lookup'; source: 'entities' | 'locations' | 'dictionary'; param: string; returns: 'full' | 'summary' }
    | { kind: 'template'; body: string }   // chip text; parameters are chips
    | { kind: 'script'; code: string };
  interface Tool {
    id: string; name: string; description: string; params: ToolParam[]; handler: ToolHandler;
    emptyResult: string; offeredTo: AIRequestType[]; callLimit?: number; enabled: boolean;
  }
  ```

- **Built-in Tools are a global catalog**, a code constant, visible in every preset. A preset stores an override per built-in id: `{ enabled: boolean; offeredTo: AIRequestType[] }`. Definition, parameters and handler are never editable; Duplicate copies the Tool into the active user preset as a user Tool. The catalog ships `get_entity` with `enabled: false, offeredTo: ['narration']`. The Experimental built-in preset ships an override with `enabled: true`. A built-in preset's overrides are constants, so its controls are read-only.
- The name follows the function-name rule: letters, digits, `_` and `-`, 1–64 characters. A user Tool's name must be unique in its preset and must not match a catalog name.
- A global call-limit default lives in the settings defaults. A Tool's own limit overrides it. Limits count per request.
- The catalog `get_entity` description is the retrieve-first wording from `involved-rescore-findings.md`.

### Tool Runner (new module, React-free)

- One entry point runs a Tool call: it takes the Tool, the model's argument string, and a read-only **Tool Snapshot** (the world plus the current scene), and returns the result text or an error result.
- It validates arguments against the Tool's parameters before a handler runs. A mismatch returns an error result the model can read. It never throws into the turn.
- **Lookup** matches without regard to case and returns `{"matches": [...]}` with every match. Entities and locations match on name and aliases; dictionary entries match on their keys. With no match it returns the Tool's empty result.
- **Template** renders the chip text through the existing prompt-template renderer, with parameters bound as chip values.
- **Script** runs in the QuickJS sandbox with its interrupt timeout. It receives `args` and a read-only snapshot and returns text or a JSON-serializable value. The stat-code sandbox is not widened: tool scripts get their own injected globals.
- The Tool Snapshot comes from the existing Chip Scene and Chip Values data, so Try It and play read the same values. It is built once per turn and shared by every call in that turn.

### Request layer (the runtime seam)

- The tool loop lives in the request layer, below the Turn Pipeline. ADR-0001's two seams are unchanged: the pipeline's request adapter gains optional Tools and a caller-supplied tool executor, and the runner never sees them.
- For a request that offers Tools, the layer sends `tools` and `tool_choice: "auto"`. It collects streamed `tool_calls` across chunks, runs each call through the executor, appends the assistant message and the `tool` results, and sends the next round. Only the final round's content becomes the pass's reply. Content streamed in a non-final round is dropped and never reaches the reveal.
- Between rounds the assistant message carries the model's content and calls. Whether it also carries the model's reasoning is open (see Further Notes). History across turns still sends narration only.
- Outgoing call IDs are remapped to nine-character alphanumeric IDs where the template needs them, and each result is matched to its call.
- Limits: calls per request per Tool, plus a hard cap on rounds per request. Requests in the same turn do not share a counter. On a limit, a malformed call, or an unknown Tool, the layer sends one more round without Tools so the model finishes in prose.
- Stop aborts the current round and any running script.
- Tool rounds are silent requests. They are captured in AI Context only with Show Silent Requests on. The status line follows the same setting.

### Capability detection

- The existing reasoning capability resolver also answers **tools supported**, per endpoint and model, in the same record.
- Sources, in order: LM Studio's model list (`tool_use` capability), Ollama's show endpoint (`tools` capability), then a probe. When the reasoning probe fires, it also carries one Tool. A 200 answers both questions. A 400 is split into two single-question probes to attribute it. When reasoning is already known from another source and tools support is not, one tools-only probe is sent. Every probe answer, including a 400, is memoized per endpoint and model so it is asked once.
- An LM Studio model without the `tool_use` capability is recorded as unsupported.
- Unknown support means no Tools are sent.

### Tools tab UI (prototype variant D)

- Tab order: Display, Output, Prompts, **Tools**, Endpoints, Data. Advanced only. The dev router covers it.
- Layout follows the stat Code Templates dialog: the list on the left (Built-In, My Tools with import and export, dashed New Tool), the read view on the right (name, summary line, Enabled, description, Try It, schema folded), and a fixed footer (Duplicate for built-in Tools; Edit and Delete for mine).
- Edit mode replaces the view. The World Editor's panel tab strip holds Definition, Parameters, Handler and Availability, each with an icon. Try It sits beside the tabs. The footer has Cancel and Save Tool.
- Panes use the shared ScrollArea with one scroller per pane.
- Description and Template use the prompt editor (undo and redo on its toolbar). Script uses the stat-code editor.
- Full screen reuses the Prompts panel's morph and shell, titled "Tools". Tool edits and an open draft survive the remount the toggle causes.
- A notice line shows when the active text endpoint doesn't support Tools.

### Highlighting and the script editor

- Add `@codemirror/lang-json` (6.0.2 at spec time) and give the read-only highlighter a language option. JSON uses the existing `tok-*` classes, so both themes work.
- JSON highlighting applies to: the Try It result, the schema view, the empty-result field, and the AI Context tool rounds.
- The stat-code editor and its analysis take a **surface** (the list of reachable names) as input instead of assuming the stat-code list. The Tool script surface lists `args` (typed from the Tool's parameters), the world and the current scene. Completions, diagnostics, the Variable menu and a "what's available" hint all read that one list, as stat code does today.

## Testing Decisions

- Good tests drive external behavior at a seam and assert what a player or the model observes: the request body sent, the result returned, the reply produced, the UI shown. They don't assert internals.
- **Runner seam: the Tool Runner entry point**, with the Sedge Landing fixture world as the snapshot. It covers argument validation, case-insensitive name, alias and key matching, every-match results, the empty result, template rendering, script results, script errors as readable results, and the script timeout. Prior art: the stat-code executor tests.
- **Runtime seam: the request layer**, driven by a scripted transport with real Tool Handlers and the Sedge Landing fixture world. It covers call collection across chunks, result correlation, multiple calls per response, non-final content dropped, fetched entries left out across turns, per-request limits, malformed and unknown calls, Stop, and silent capture. Prior art: the tool-call probe's scripted-transport tests and the AI Stream tests.
- **Capability seam: the reasoning capability resolver**, at its fetch stub. It covers each source, the bundled probe, the tools-only probe when reasoning is already known, the 400 split and its memo, the untrained LM Studio model, and unknown meaning no Tools. Prior art: the existing resolver tests.
- **UI seam: the Tools tab**, with component tests for create, edit, Duplicate, Delete, validation, Try It, the full-screen round trip and the endpoint notice. Prior art: the Settings modal tests and the Code Templates dialog tests.
- **One Playwright spec** defines a Tool, plays a turn against a mocked endpoint that calls it, and checks the tool result reached the next round and the narration landed. Prior art: `ai-context-reasoning.spec.ts`.
- Each new guard is proven by reinstating its bug and watching the test fail.

## Out of Scope

- Action Tools that change stats, traits or location (Q3; deferred).
- Tools defined in worlds (ADR-0008).
- Fallback prompt text for endpoints without tool support. The prompt is sent unchanged.
- Carrying fetched entries across turns.
- A reasoning prefill before Tool calls. It broke tool delivery on MeroMero (`prefill-order-findings.md`).
- Widening the stat-code sandbox.

## Further Notes

- Evidence: `docs-internal/specs/narration-tool-call-probe/` — especially `involved-rescore-findings.md` (retrieve-first description, 12/12 involved coverage) and `prefill-order-findings.md` (entity order has no effect on the control).
- **Open: reasoning kept between rounds.** Sending the model's own reasoning back on the assistant message between rounds is unproven on LM Studio, and `prefill-order-findings.md` shows the thought channel is fragile on MeroMero. A probe ticket runs before the request-layer ticket. If LM Studio accepts the field and the loop still completes, the layer keeps it; if it drops or rejects it, the loop ships without it and the model re-plans after each lookup.
- The cloud default endpoint rejects `tool_choice: "auto"` today. Capability detection keeps Tools off it until its server enables tool calling.
- Only MeroMero is proven to complete the loop. Cydonia and a non-tool model should be tried once the loop ships, to confirm that "no Tools sent" behaves well.
- Preset export shape changes (Tools added). World and save export shapes do not.
