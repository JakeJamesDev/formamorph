# 01: Store Tools in Presets and the Catalog

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## Parent

[Tool Creator](docs-internal/specs/tool-creator/spec.md)

## What to build

A player's prompt preset can hold Tools, and every preset can see the built-in catalog. A user Tool has a name, a description, parameters, a Tool Handler, an empty result, the prompts that offer it, an optional call limit and an enabled flag. A built-in Tool is a code constant in a global catalog; a preset stores only `{ enabled, offeredTo }` per built-in id. The catalog ships `get_entity` with the retrieve-first description, off by default and offered to narration only. The Experimental built-in preset ships an override that turns it on. Built-in presets never take edits.

Exporting a preset carries its user Tools and its built-in overrides. Importing a preset parses them, rejects a malformed Tool without losing the rest of the preset, and reports when the preset holds Script Tools so the caller can show a notice. Tools persist with presets across sessions.

The Tool shape comes from the prototype and encodes the settled decisions:

```ts
type ToolHandler =
  | { kind: 'lookup'; source: 'entities' | 'locations' | 'dictionary'; param: string; returns: 'full' | 'summary' }
  | { kind: 'template'; body: string }
  | { kind: 'script'; code: string };
interface Tool {
  id: string; name: string; description: string; params: ToolParam[]; handler: ToolHandler;
  emptyResult: string; offeredTo: AIRequestType[]; callLimit?: number; enabled: boolean;
}
```

Model rationale: Opus at high effort suits a change that touches shared domain types, the preset store, share parsing and tests at once, with an export-shape change that must stay additive.

## Acceptance criteria

- [ ] A user preset stores user Tools and per-built-in overrides; a built-in preset exposes its shipped constants and refuses edits.
- [ ] The catalog holds `get_entity` with the retrieve-first description, `enabled: false`, `offeredTo: ['narration']`; Experimental's override sets `enabled: true`.
- [ ] A Tool name accepts letters, digits, `_` and `-`, 1–64 characters, unique within its preset and never equal to a catalog name.
- [ ] A global call-limit default lives in the settings defaults.
- [ ] Preset export includes Tools and overrides; import round-trips them, drops a malformed Tool with a reported error, and reports the presence of Script Tools.
- [ ] Presets without Tools still import and export unchanged.
- [ ] The response that closes this ticket states that the preset export shape changed.
- [ ] Four gates green; each new guard proven by reinstating its bug.
