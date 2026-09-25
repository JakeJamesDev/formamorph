# 02: Run a Tool Call in the Tool Runner

Status: ready-for-agent
Blocked by: 01 — Store Tools in Presets and the Catalog
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## Parent

[Tool Creator](docs-internal/specs/tool-creator/spec.md)

## What to build

A React-free Tool Runner with one entry point. It takes a Tool, the model's argument string and a read-only Tool Snapshot, and returns result text or an error result the model can read. It never throws into the caller.

The Tool Snapshot is the world plus the current scene, built from the existing Chip Scene and Chip Values data so Try It and play read the same values. It is built once and passed in; the runner never reaches into React or storage.

Handlers: **Lookup** matches one parameter against entities and locations by name and aliases, and dictionary entries by their keys, all case-insensitive, and returns `{"matches": [...]}` with every match, full description or summary as configured; no match returns the Tool's empty result. **Template** renders the chip text through the existing prompt-template renderer with parameters bound as chip values. **Script** runs in the QuickJS sandbox with its interrupt timeout, receives `args` and the read-only snapshot through its own injected globals, and returns text or a JSON-serializable value. The stat-code sandbox is not widened.

Model rationale: Opus at high effort for QuickJS global injection, read-only snapshot design and a validation contract that must hold against arbitrary model output.

## Acceptance criteria

- [ ] Arguments are validated against the Tool's parameters (types, required, enum options) before any handler runs; a mismatch returns an error result naming the parameter.
- [ ] Lookup returns every match for an ambiguous name and the empty result for none; matching covers name, aliases and dictionary keys without regard to case.
- [ ] Template output binds each parameter as a chip value.
- [ ] Script sees `args` and a read-only snapshot; a script that tries to mutate the snapshot cannot affect the world; a script error and a timeout both return readable error results.
- [ ] The stat-code sandbox's exposed surface is unchanged.
- [ ] Runner tests use the Sedge Landing fixture as the snapshot and cover every case above; each guard proven by reinstating its bug.
- [ ] Four gates green.
