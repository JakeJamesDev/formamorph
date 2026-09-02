# Per-World Narration Prompt — Spec

**Status: SPECED (2026-08-05), not yet built.** First prerequisite of the parked chat world (see `chat-world-st-parity.md`). All decisions below are user-confirmed.

## Goal

Let a world author replace the narration system prompt for their world. Today a world's only prompt lever is `worldOverview.systemPrompt`, which fills the `## Game World` *section* of whatever the player's preset provides — enough to describe a setting, not enough to change what the narrator *is* (the chat world needs a dialogue-first narrator, not a scene-event narrator).

## Decisions (interviewed & confirmed)

| Question | Decision |
|---|---|
| Surfaces | **Narration system prompt only** for now; the container is a map so more keys can be added later without another shape change. |
| Precedence | **World wins, player can opt out** — a per-world toggle restores the player's preset. |
| Authoring | **Chip editor** — reuse the Lexical prompt editor from Settings → Prompts (same tokens, same preview). |
| Tuning | **Text only.** Sampler pins, verbatim turns, reasoning stay player-side. |
| Opt-out home | **The world-card popup on the main menu** (the `showWorldModal` dialog in [MainMenu.tsx:1722](../src/views/MainMenu.tsx:1722)). |
| Transparency | **Indicator + viewable**: the popup shows the world ships a custom narration prompt and lets the player read the text — same spirit as the stat-code "Examine Code" affordance already in that dialog. |

## Data model

- `WorldOverview.promptOverrides?: Partial<Record<PromptTextKey, string>>` — only `systemPrompt` is recognized initially; unknown keys are preserved but unused (forward compat). Absent = world has no overrides (all existing worlds).
- **Export-shape change (additive).** Old app versions ignore the field. Version bump is the user's call at release time.
- The player's opt-out is **local-only** (never exported): per-world id, default = use the world's prompt. Storage alongside the other local per-world prefs (localStorage).

## Runtime resolution

Effective narration system prompt, per turn:

1. World has `promptOverrides.systemPrompt` **and** the player hasn't opted out → use the world's text.
2. Otherwise → the active preset's `systemPrompt` (current behavior, untouched).

- Token substitution runs on whichever text wins — all chips (`<WORLD DESCRIPTION>`, `<LOCATION|…>`, `<ENTITIES|…>`, `<DICTIONARY>`, …) work in world-authored text. `<WORLD DESCRIPTION>` still resolves to `worldOverview.systemPrompt`, so an author can keep the Game World section inside their custom frame or inline it.
- Section styles (markdown/labels/xml) are a preset concern; world text is verbatim.
- Only the narration surface changes. Choices, planner, stats, memory, clock, diary, etc. keep using the preset — a world cannot break them.
- `<MARKDOWN GUIDANCE>` / `<LENGTH GUIDANCE>` substitution applies as it does for preset text (they're tokens like any other).

## UI

**World Editor** — a "Narration Prompt" area (Overview panel, near the existing System Prompt field): off by default; "Customize" seeds the chip editor with the shipped Default narration prompt so authors edit rather than write from scratch. Clearing/disabling removes the override.

**Main-menu world popup** — when the selected world carries an override: an info row (not warning-styled — informative, unlike the stat-code trust banner) with
- the indicator text ("This world customizes the narration prompt"),
- a **View** button opening the read-only text,
- the **opt-out toggle** ("Use this world's narration prompt", default on, remembered per world).

**AI-context viewer** already shows the assembled system prompt, so in-game inspection comes free.

## Out of scope (deliberate)

- Other prompt keys, choices prompt, user-message templates, tuning of any kind.
- A community-listing badge (revisit if downloaded-world feedback asks for it).
- Any change to shipped prompt text — this feature is plumbing; **no probe run needed**. The chat world's actual custom prompt, when authored, ships with probe evidence per `prompt-writing-guide.md`.

## Build checklist

- [ ] Type + migration touchpoints (`migrateWorld` no-op pass-through; import boundaries preserve the field)
- [ ] Resolution in GameViewer narration request (+ opening scene, same surface)
- [ ] Opt-out storage + world popup UI (indicator, viewer, toggle)
- [ ] World Editor chip-editor section
- [ ] Publish/export round-trip (`publishPayload`, backup/restore)
- [ ] Tests: resolution precedence, opt-out, migration, round-trip
- [ ] Changelog In-Progress entry; export-shape reminder to user
