# Per-Prompt Endpoint Routing — Spec

Let each AI prompt kind send its request to a different text-endpoint preset. A power-user
flexibility feature: any of the 15 `AIRequestType` kinds can be pinned to any preset (including
the built-in Default), while unpinned kinds keep following the globally active preset.

Status: **designed, not built**. Decisions below were aligned in the 2026-08-07 interview.

## Decisions (settled)

| Question | Decision |
|---|---|
| Use case | General power-user flexibility — no single hardcoded scenario |
| Granularity | Per prompt kind, all 15 `AIRequestType`s individually |
| Storage | Global localStorage map (like the old sampler map) — **not** part of prompt presets, **not** per-world |
| Default semantics | "Follow Active" — an unassigned kind tracks the global preset selector exactly as today |
| Missing/ghost preset | Silent fallback to the active preset (same as unassigned) |
| UI placement | An endpoint dropdown in the per-prompt tuner rows in Settings |
| Context detection | Lazy probe on first routed call, cached per `endpoint\|model` for the session; manual override wins |
| Deliverable shape | This spec first; implementation in a later turn |

## Data shape

```ts
/** kind -> text-endpoint preset id ('default' = the built-in). Absent kind = Follow Active. */
type PromptEndpointMap = Partial<Record<AIRequestType, string>>;
```

- New localStorage record `${APP_ID}_promptEndpoints` with its own codec (malformed → `{}`).
- Ids reference `TextEndpointPresetStore` entries ([textEndpointPresets.ts](../src/lib/textEndpointPresets.ts)).
  `'default'` (`DEFAULT_TEXT_PRESET_ID`) is a valid target and pins the built-in even when a custom
  preset is globally active.
- A ghost id (preset deleted) behaves exactly like an absent entry. Optionally prune entries in the
  delete handler; either way resolution must tolerate ghosts.
- **No world/save/export shape change** — this is device-local settings state only.

### Why global, not preset-scoped

Per-prompt samplers/reasoning/verbatim were folded *into* prompt presets
([SettingsContext.tsx:485](../src/contexts/SettingsContext.tsx:485)) and travel with preset
sharing. Endpoint routing deliberately does **not**: shared presets would leak or expect endpoint
preset names the recipient doesn't have. The routing dropdown lives visually inside the tuner rows
but writes the global map, is unaffected by prompt-preset switching, and is excluded from
`buildSharedPreset` / import.

## Resolution semantics

One resolver, called per request (not once per session):

```ts
resolveEndpointForKind(kind): {
  endpointUrl, apiToken, modelName, maxTokens, contextWindow,
  isBuiltIn,                       // routed target is the Default built-in
  supportedReasoningEfforts,       // from the sig-keyed cache, may be null until probed
}
```

- Absent/ghost entry → the current `activeValues(textPresetStore)` path, unchanged behavior.
- Mapped entry → that preset's `TextEndpointValues` layered over defaults (same layering
  `activeValues` uses today).
- `isBuiltIn` becomes **per-request**: sampler fallback (`defaultPromptSampler`) and every other
  "built-in engine vs custom endpoint" branch must take the routed target's flag, not the global
  one. Routed-to-Default sends the global slider value; routed-to-custom omits the field
  ([[endpoint-temperature-behavior]]).

### Context window (lazy probe + cache)

Auto-detection today runs only for the active endpoint
([SettingsContext.tsx:502](../src/contexts/SettingsContext.tsx:502)). For routed prompts:

- Session-level cache keyed `endpoint|model` — same signature scheme as the existing
  `reasoningSupportCache` ([SettingsContext.tsx:525](../src/contexts/SettingsContext.tsx:525)).
- First routed call with a cache miss fires `fetchContextLength` (non-blocking is fine for the
  first turn: use the preset's `contextWindowOverride` if set, else the shipped default, until the
  probe lands).
- A preset's manual `contextWindowOverride` always wins over the probe.

### Reasoning-effort support

`reasoningSupportCache` is already keyed per `endpoint|model`, so routing slots in: look up the
routed sig, and lazily run `detectSupportedReasoningEfforts` for sigs the active-endpoint effect
never probed. Per-prompt reasoning settings (preset-scoped) then apply against the routed
endpoint's supported list.

## UI

- **Location:** the per-prompt tuner rows in the Settings modal (where sampler/reasoning overrides
  live). Each row gains an endpoint dropdown.
- **Options:** `Follow Active` (default, shows the currently-resolved preset name in muted text,
  e.g. "Follow Active (Cydonia)") · `Default` · each user preset by name.
- **State cues:** a pinned row should be visually distinct (same treatment the sampler "Custom"
  toggle uses) so a scan of the list shows what's routed where.
- Deleting a preset that rows point at needs no confirmation — those rows just show Follow Active
  again (fallback semantics).

## Caveats to document (not solve) in v1

- **Reachability:** `useAiReachable` probes only the active endpoint. A routed endpoint that's down
  surfaces as a normal request failure at call time. Open item: a per-row reachability badge.
- **Local-model thrash:** concurrent turn requests ([[concurrent-turn-requests]]) can now hit two
  local servers (or two models on one server) simultaneously — on one GPU that spills to CPU
  ([[probe-model-loading]]). User's responsibility; worth a line in the docs.
- **Editor-side AI calls** (`AiFieldToolbar`, image tag generation) are not `AIRequestType`
  gameplay prompts and keep using the active endpoint. Image endpoint presets are a separate lane
  entirely — out of scope.

## Out of scope

Per-world routing · inclusion in shared prompt presets · routing groups/buckets · image endpoints
· reachability badges (open item above).

## Implementation touchpoints

| Area | Change |
|---|---|
| [promptEndpoints.ts](../src/lib/promptEndpoints.ts) (new) | Map type, codec, `resolveForKind` pure helper + tests |
| [SettingsContext.tsx](../src/contexts/SettingsContext.tsx) | Persist the map; expose `resolveEndpointForKind`; extend the context/reasoning probe caches to routed sigs |
| [GameViewer.tsx](../src/views/GameViewer.tsx) | The big one: it destructures one `endpointUrl/apiToken/modelName/maxTokens/contextWindow` set at the top (~line 299) and threads it through every request builder. Each AI call site must instead resolve per kind |
| [promptSamplers.ts](../src/lib/promptSamplers.ts) | `isBuiltIn` argument now comes from the routed target per call |
| [SettingsModal.tsx](../src/components/modals/SettingsModal.tsx) | The dropdown in the tuner rows |
| [promptPresetShare.ts](../src/lib/promptPresetShare.ts) | Assert (test) the routing map is never included |

The GameViewer threading is the bulk of the work — most helpers take endpoint params today, so the
change is mostly "resolve at the call site" rather than new plumbing, but there are many call
sites and the monolith makes each one a manual audit.
