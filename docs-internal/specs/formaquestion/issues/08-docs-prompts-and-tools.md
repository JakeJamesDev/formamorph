# 08: New pages, Prompts and Tools

Status: ready-for-agent
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

- [ ] Both pages exist, follow the writing guide and use exact control names
- [ ] Every Prompts and Tools tab, surface and editor tab maps to a heading
- [ ] Every built-in Tool in the catalog is listed with what it returns
- [ ] The tool-support rule matches ADR-0008
- [ ] The sidebar and the home index list both pages
- [ ] The known-gaps entries for these surfaces are removed, and the coverage test passes
- [ ] Four gates green
