# 🧰 Tools
<!-- keywords: plugins, extensions, is it safe, tab is missing, ai looks things up, agent abilities, mcp -->
<!-- route: settings.tools -->

A **Tool** is a function the AI can call during a request. It gets information the AI does not have, such as the full entry of an entity. The app runs the Tool and sends the result back, and the AI then writes its reply.

A Tool only reads. It never changes the world, the save or your settings.

The **Tools** tab in Settings lists the built-in Tools and your own Tools. It shows in **Advanced** mode only. To open it, open **Settings**, select **Advanced** in the switch next to the title, then open the **Tools** tab.

## How to Turn On Tools
<!-- keywords: function calling, calling, enable, ai call, let the ai use, functions, activate, switch on lookups, nothing gets called, checkbox greyed, per prompt set, which prompts get it, filled dot meaning -->
<!-- route: settings.output -->

1. Open **Settings**.
2. In the switch next to the title, select **Advanced**.
3. Open the **Output** tab.
4. In the **Tools** section, select the **Tools** checkbox.
5. Open the **Tools** tab.
6. In the **Preset** list at the top, select the prompt preset to change. This also makes it the active preset for your games.
7. Select a Tool in the list, then select the **Enabled** checkbox.
8. Under **Offered To**, check that the list names the prompts that should get the Tool.

The dot next to a Tool's name is filled while the Tool is on in that preset. A note at the top of the tab tells you when your prompts get no Tools: when the **Tools** checkbox is clear, or when your text endpoint does not support Tools. See [Endpoints Without Tool Support](#endpoints-without-tool-support).

## How to Make a Tool
<!-- keywords: create, custom, new function, function calling, script, write, build my own, define arguments, inputs the ai sends, clone a built in, save button disabled, plugin authoring, javascript helper -->
<!-- route: settings.tools -->

1. Open the **Tools** tab.
2. Under **My Tools**, select **New Tool**.
3. On the **Definition** tab, type a **Name**, such as `find_person`.
4. Type a **Description** that tells the AI what the Tool does and when to call it. **Add Outline** adds the four headings a good description has.
5. On the **Parameters** tab, select **Add Parameter** for each value the AI passes.
6. Set the **Name**, **Type** and **Description** of each parameter.
7. On the **Handler** tab, pick the **Handler Type** and fill in its settings. See [Handler](#handler).
8. Run the Tool in **Try It** next to the tabs. See [How to Try a Tool](#how-to-try-a-tool).
9. Select **Save Tool**.

A new Tool is on in the active preset. **Save Tool** is off while the Tool has a problem. The line next to it names each fix and its tab, such as "Name the Tool (Definition) to save".

To start from a built-in Tool, select it and then **Duplicate**. To change your own Tool later, select it and then **Edit**.

## How to Try a Tool
<!-- keywords: test, run, debug, preview, check, dry run, simulate a call, sample output, manual input values, red message, result is stale, see raw definition -->
<!-- route: settings.tools -->

1. Select the Tool in the **Tools** tab, or open it with **Edit**.
2. Under **Try It**, type a value for each parameter. A parameter of type **True/False** or **One of a List** shows a list.
3. Select the **Run** button.

**Try It** runs the Tool with the same runner the game uses, and shows the text the AI would read. An error shows in red, with the text the AI would read under it. In a game, **Try It** runs on the world you have open. Outside a game, it runs on a sample world.

Open **What the AI Receives** under **Try It** to read the Tool's definition as the AI gets it. When you edit the Tool after a run, a note tells you the result is from before your last edit.

## How to Share Your Tools
<!-- keywords: export, import, file, json, send, copy, back up, give to a friend, move to other device, load someone elses, security warning, is it malicious, bundle with preset -->
<!-- route: settings.tools -->

1. Open the **Tools** tab.
2. Next to **My Tools**, select **Export Tools** to save `tools.json`, or **Import Tools** to add Tools from a file.

An import skips a Tool you already have, and names it. A file with a Script Tool shows a warning, because a script runs code when the AI calls it. Read a script before you turn it on.

A shared prompt preset also carries a copy of each of your Tools that is on in it. See [Sharing a Preset](Prompts#sharing-a-preset).

---

## When the AI Calls a Tool
<!-- keywords: never gets used, not triggering, conditions, endless loop, call log, turn got slower, hit the limit, see what it fetched, extra api usage -->

A request offers a Tool only when all of these are true:

- **Tools** is on in Settings → **Output**.
- The Tool is **Enabled** in the active prompt preset.
- The prompt is in the Tool's **Offered To** list.
- The text endpoint of that prompt supports Tools.

The AI decides when to call a Tool. The Tool's **Description** tells it when. Each round of calls is one more request, so a turn with Tool calls takes longer. One prompt sends at most 6 requests, the last one included.

**Max Calls per Request** caps how many times the AI can call one Tool for one prompt. The default is 4. A call past the cap gets an error. After a call past the cap, a call to an unknown Tool or a call with unreadable arguments, the AI gets one last request with no Tools. It then writes its reply.

To see the calls, turn on **Show Silent Requests** in Settings → **Display**. The status line then shows **Looking up…** while the AI calls Tools. In the AI Context inspector, a request that called Tools has a **Tool Rounds** section with each call and its result. See [The AI Context Inspector](How-to-Play#the-ai-context-inspector).

## Endpoints Without Tool Support
<!-- keywords: unsupported model, not compatible, capability check, backend ignores it, which models work, note replaces checkbox, falls back to summaries, local model limits, tool calling, function calling, tool use -->

The app sends Tools only to an endpoint and model that it knows support them. It learns this from the server's model list, such as the `tool_use` flag in LM Studio, or from a one-time check. An LM Studio model without the `tool_use` flag gets no Tools.

On an endpoint with no Tool support:

- The request carries no Tools.
- The prompt text does not change. A prompt that relies on a Tool then sends its summaries only, such as the entity summaries of the [Experimental](Prompts#the-experimental-preset) preset.
- The app does not try again with Tools. One request goes out, the same as without Tools.

The **Tools** tab shows a note while your text endpoint gets no Tools. In Settings → **Output**, the **Tools** row shows a note in place of its checkbox.

## The Tools Tab
<!-- keywords: panel layout, enlarge window, per prompt targeting, call limit field, clone button disabled, erase permanently, applies to all presets -->

The list on the left has two groups. **Built-In** holds the Tools that ship with the app. **My Tools** holds yours, with **New Tool** at the end. The **Preset** list at the top picks which prompt preset the **Enabled** checkboxes change. It is the same choice as on the **Prompts** tab, so it also sets the active preset. Built-in presets have their own switches too.

Select a Tool to see it on the right:

| Part | What it does |
|---|---|
| Name and summary | The Tool's name, and one line on what its handler does |
| **Enabled** | Turns the Tool on in the selected preset |
| **Offered To** | Sends the Tool with these prompts. **No Prompts** offers it to none. |
| **Max Calls per Request** | Caps how many times the AI can call this Tool for one prompt. Leave it blank for the default of 4. |
| Description | The text the AI reads about the Tool |
| **Try It** | Runs the Tool. See [Try It](#try-it). |

**Offered To** and **Max Calls per Request** apply to the Tool in every preset. On a built-in Tool, they are the only parts you can change.

The buttons under the Tool act on it. A built-in Tool has **Duplicate**, which makes an editable copy under **My Tools**. The copy is on in the active preset. **Duplicate** is off for **recall**, because only the built-in Tool can search memories. Your own Tool has **Edit** and **Delete**. **Delete** removes the Tool from every preset, and it cannot be undone.

The **View full screen** button opens the tab in a large window.

## The Built-In Tools
<!-- keywords: skill check, random number, rng, fair dice, stock functions, search past events, fetch lore, fetch character sheet, what ships included -->

Each built-in Tool is offered to **Narration** by default. Each one is off until you turn it on, except **get_entity** in the **Experimental** preset.

| Tool | The AI passes | It returns |
|---|---|---|
| **get_entity** | `name`: an entity's name | JSON with a `matches` list. Each match has the entity's id, name and full description. It matches names and aliases. |
| **get_location** | `name`: a location's name | JSON with a `matches` list. Each match has the location's id, name and full description. |
| **get_dictionary_entry** | `keyword`: a term from the story, or an entry's name | JSON with a `matches` list. Each match has the entry's id, name and text. It matches entry names and trigger keywords. |
| **recall** | `query`: a few words from a past event | JSON with a `matches` list of up to 5 memories, oldest first. Each match has the turn, the kind (`digest` for a memory summary, or `diary`), the text, and the writer of a diary entry. |
| **roll** | `dice`: dice notation, such as `2d6+1` or `1d20` | JSON with the dice, each die's roll, the modifier and the total. It takes 1 to 100 dice of 2 to 1000 sides, and a modifier from -1000 to 1000. Bad notation returns text that explains the problem. |

The lookup Tools return an empty `matches` list when nothing matches. Matching ignores letter case.

## The Tool Editor
<!-- keywords: naming rules, boolean, enum dropdown, string or integer, canned response, nothing found message, time limit, what code can access, three behavior kinds -->
<!-- route: settings.tools -->

**New Tool** and **Edit** open the editor. It has three tabs, with **Try It** next to them. **Cancel** closes it without a save.

### Definition

| Field | What it holds |
|---|---|
| **Name** | The name the AI calls. Use only letters, digits, `_` and `-`, from 1 to 64 characters. It cannot match a built-in Tool or another of your Tools. |
| **Description** | What the Tool does and when to call it. **Add Outline** adds the headings **Purpose:**, **Use when:**, **Input:** and **Output:** that are not there yet. |

### Parameters

Each parameter is one value the AI passes. A Tool with no parameters takes no arguments.

| Field | What it holds |
|---|---|
| **Name** | The argument name. Two parameters cannot share a name. |
| **Type** | **Text**, **Number**, **True/False** or **One of a List** |
| **Description** | Tells the AI what to pass |
| **Options** | The values of a **One of a List** parameter, separated by commas. Shows for that type only. |
| **Required** | The AI must pass this value. Clear it to make the value optional. |

**Remove Parameter** deletes a parameter.

### Handler

The **Handler** tab sets the Tool Handler: the part that runs when the AI calls the Tool.

| Handler Type | What it does |
|---|---|
| **Lookup** | Searches world data for the value the AI passes |
| **Template** | Returns your text, with the AI's values in place |
| **Script** | Runs your code on the AI's values and returns the result |

**Empty Result** is the text the AI gets when the handler finds nothing. The section under it holds the settings of the picked type:

- **Lookup Settings.** **Search** picks **Entities**, **Locations** or **Dictionary Entries**. **By Parameter** picks the parameter to search by. **Returns** picks **Full Description** or **Summary**, for entities and locations.
- **Template Settings.** **Template** is the text to return. Insert a parameter chip where the AI's value goes.
- **Script Settings.** **Script** is JavaScript. It reads `args`, `world`, `scene` and `placeholders`, and returns text, or any other value as JSON. The ⓘ next to **Script** opens **What a Script Can Read**, which lists every value. A script runs in a sandbox and stops after one second.

When you switch the **Handler Type**, the editor keeps the settings of the other types until you close it.

## Try It

**Try It** shows on the selected Tool and next to the editor. See [How to Try a Tool](#how-to-try-a-tool). In the editor it runs the Tool as it would save, so you can test a change before **Save Tool**.

## Related

- [📜 Prompts](Prompts): prompt presets, which carry the **Enabled** switches
- [⚙️ Settings](Settings): the **Tools** row in the **Output** tab, and the text endpoints
- [🧮 Stat Code Guide](StatCodeGuide): the other place you write JavaScript for a world
