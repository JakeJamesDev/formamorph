# 08: New pages, Prompts and Tools

Status: done
Base: b3288c9a
Blocked by: 01 — Docs checks and surface map
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A player can read how prompt presets and Tools work. Two new docs pages cover Settings → Prompts and Settings → Tools.

**Prompts** covers:

- what a prompt preset is; make, copy, share and publish one; the Overview
- the prompt tabs and what each prompt does in a turn
- the surfaces of a prompt: System, User, Messages, Options
- Request Anatomy and the chip editor: a chip sends text, no chip sends nothing
- per-prompt options: endpoint, Native Reasoning, Reasoning Budget, Max Output, Include Attachments, samplers
- the Experimental preset
- the prompt diff viewer

**Tools** covers:

- what a Tool is and when the AI calls one
- the built-in Tools: `roll`, `recall`, `get_location`, `get_dictionary_entry`, and any other in the catalog
- make a Tool: Definition, Parameters, Tool Handler
- Try It
- enabling a Tool per preset, and the Output → Tools switch
- endpoints with no tool support: the request carries no Tools and the prompt sends summaries only (ADR-0008)

Use the glossary's words: Tool, Tool Handler, Request Anatomy, Chip. Add "How to…" sections: edit a prompt, route a prompt to another endpoint, make a preset, make a Tool, try a Tool.

The ticket 01 gate checks only ids in the dev-router ledger. The per-prompt tabs of Settings → Prompts have no id, so the gate does not enforce them. Add their ids to the ledger and the surface map, or check them by hand and list them in the commit body.

Recommended model rationale: both areas are new, dense, and have rules (capability gate, chip injection) that are easy to state wrongly.

## Acceptance criteria

- [x] Both pages exist, follow the writing guide and use exact control names
- [x] Every Prompts and Tools tab, surface and editor tab maps to a heading
- [x] Every built-in Tool in the catalog is listed with what it returns
- [x] The tool-support rule matches ADR-0008
- [x] The sidebar and the home index list both pages
- [x] The known-gaps entries for these surfaces are removed, and the coverage test passes
- [x] Four gates green

## Comments

**Built.** `docs/Prompts.md` and `docs/Tools.md`, linked from the sidebar, the home index and Settings.

- **Per-prompt tabs are enforced.** A new `settingsPrompts` ledger entry (the existing `subtab=` slot, drift-tested against `allGroupedTabs()`) puts all 15 prompt ids in the coverage gate. They map to "The Prompts", one row per prompt with its job and when it runs (spec ruling on shared headings). Guard bite: renaming that heading fails all 15 ids.
- **`worldPrompts` moved here** from ticket 10's gaps, per the spec session. It maps to "World Prompts and the Diff Viewer".
- **Review folded in.** Wrong place for **Use this world's prompt**, the per-Tool meaning of **Max Calls per Request** and the 6-request cap, the Tools tab's **Preset** list also setting the active preset, a stale ledger comment, and STE fixes.

**Adjacent, not fixed.**
- The per-prompt **Endpoint** ⓘ says "the **AI Endpoints** tab"; the tab is **Endpoints** (`SettingsModal.tsx` `PromptEndpointField`).
- `PromptEndpointField`'s doc comment says routing is not preset-scoped and stays editable under a built-in preset. The code disables it there.
- Home.md and the Related lists call Tools "functions". The glossary avoids that word, but its own definition uses it; left as is.
