# 04: Settings reference renders the production sections against local state

Status: ready-for-human
Base: c025c78f
Blocked by: 03 — Extract the Settings Display and Output sections into production components
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

## What to build

The Settings reference's Display and Output cards render the extracted production sections against a local in-memory source built from the settings defaults. Changing any control leaves real settings, the app theme, and disk untouched. Where production would persist a theme, download an embedding model, or call out, the local source writes a status line instead. The reference offers the production Simple/Advanced mode control. The Live Sample for palette and font moves out of the Appearance section into its own block. The Control States card is unchanged.

The guide's production mapping names the two section components.

Recommended model rationale: wires settled components into the reference and updates the guide; bounded work with clear tests.

## Acceptance criteria

- [x] Display and Output in the reference show the same sections, rows, order, hints, and controls as the Settings dialog
- [x] Switching the mode control shows the Simple and the Advanced row sets
- [x] Changing controls writes no persistent settings and no theme, asserted by test
- [x] With the embedding loader mocked, turning on semantic memory or semantic lore in the reference does not call it, asserted by test
- [x] Status lines appear where production would download, persist a theme, or call out
- [x] The Live Sample stands as its own block and the Control States card still shows all six states
- [x] The guide's production mapping names the section components; new copy has a Writing review entry
- [x] The showcase registry test passes
- [x] Four gates green; verified in the showcase at desktop and 375px, both themes
