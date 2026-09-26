# Tool Call Ideas

A parking lot for Tool ideas we have not specced. Read it before a new Tool effort.

📌 **Specced already:** `get_location`, `get_dictionary_entry`, `recall`, and `roll` are in the tools-catalog-and-script-placeholders spec.

## Sources

| Source | What it adds |
|---|---|
| [SillyTavern Function Calling docs](https://github.com/SillyTavern/SillyTavern-Docs/blob/main/For_Contributors/Function-Calling.md) | Official Tool extensions: Image Generation, Web Search, RSS, Weather, D&D Dice. A `stealth` flag keeps a result out of the chat and skips the follow-up request. |
| [TunnelVision](https://github.com/Coneja-Chibi/TunnelVision) | The AI searches **and writes** the lorebook: Search, Remember, Update, Summarize, and more. |
| [TheLibrarian](https://github.com/ExtensionMuncher/TheLibrarian) | A read-only TunnelVision: the AI fetches lore that was not injected. |
| [StateSmith](https://github.com/Atlas4285/SillyTavern-StateSmith) | The AI changes tracked state fields through Tool calls. |
| [NPCNames](https://github.com/elana-voss/SillyTavern-Extension-NPCNames) | A tagged list of about 6,000 names that the AI can draw from. |
| [MathTools](https://github.com/chtcrack/MathTools-SillyTavern-Extension) | Dice, math, and sandboxed code that run in a Tool, not in the model. |

## Read-only ideas

These fit the handlers we have.

### 🎲 `check`: roll against a stat

- **Idea:** d20 plus a modifier from a stat, against a difficulty. Returns pass or fail and the margin.
- **Why:** `roll` gives fair dice, but the AI still picks the difficulty and reads the result. A check makes the stat matter.
- **How:** a script over `scene.stats`. It works today.
- **Open:** how a stat's range maps to a modifier. Stats have author-set min and max values, so no single formula fits every world.

### 🏷️ `new_name`: draw a fresh name

- **Idea:** the AI asks for a name, and the Tool draws one that no entity uses yet.
- **Why:** small models repeat the same few names ("Elara", "Kael").
- **How:** a script over a Wildcard placeholder of names, once scripts can read placeholders.
- **Needs work:**
  - A script sees resolved values only, and a Wildcard resolves to **one** name per playthrough. So the script can't draw from the list. It needs the value list, or a separate list source.
  - "Unused" must cover runtime characters, not only authored entities.
  - Two calls in one turn could return the same name.
  - Where does the list live? Options are a world placeholder, a dictionary entry, or a list that ships with the app.
  - Should the name persist? Today a name persists only if the runtime-character pass picks it up from the prose.

### 📜 Rules lookup

- **Idea:** rules that are not lore, such as magic costs or a faction's laws, fetched on demand.
- **How:** a dictionary entry plus `get_dictionary_entry` already covers this. It's an authoring pattern for the docs, not a feature.

## Ideas that change the playthrough

Each one needs a new handler kind that writes to the playthrough state. Hard constraint 5 forbids gameplay writes to the authored world. So every write goes to the save, never to GameDataContext.

| Tool | Idea | Overlaps | Open question |
|---|---|---|---|
| `adjust_stat` | Narration changes a stat in the same turn, so the numbers match the prose. | The stat pass. | Do we replace the pass, or keep both? Two paths can disagree. |
| `remember` | The AI records a new fact or person during narration. | Runtime characters and milestone memory, which already run as passes. | What does a Tool do that a pass does not? |
| `show_scene` | The AI asks for a scene image when a moment deserves one. | Scene images. | How do we stop it from asking every turn? A cooldown, or a call limit per N turns? |
| `set_expression` | Narration drives a VRM expression or the TTS mood. | Nothing today. | Needs a "no follow-up" mode like SillyTavern's `stealth`, so the call costs no second request. |

🧭 **The real decision:** do Tools become a second way to change state, beside the passes? Settle that before any single Tool in this table.

## Poor fits

| Idea | Why not |
|---|---|
| Web Search, RSS, real-world weather | They break immersion. They also give scripts in shared presets network access, which the sandbox must never allow. |
| MCP bridge | Maybe later for the desktop build. Not for the browser app. |

## Things to keep in mind

- ⚖️ **Each Tool costs tokens and a decision.** Silver-Siren at 12B may call the wrong Tool as the list grows. Keep the built-in set small, and probe each addition.
- 🧪 **Descriptions are prompt text.** Every built-in description needs probe numbers per the prompt-writing guide.
- 📦 **New handler sources or kinds change the export shape.** Tool packs and preset exports carry user Tools, so the user makes that call.
