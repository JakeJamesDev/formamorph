# 01: Overview on a User Preset

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: `docs-internal/specs/prompt-sharing/spec.md`

## What to build

A user prompt preset gets an Overview screen in Settings → Prompts. The author fills in Author, Description,
Tags, and Models. The data stays on the preset in local storage. Sharing comes in ticket 02.

- A user preset gains an optional `overview` block: `author`, `description`, `tags`, `models`.
- The settings context gets one Overview setter. It does nothing on a built-in preset, like the other
  preset-scoped tuning.
- Tags are stored trimmed, lowercased, and de-duplicated. Models are stored trimmed and de-duplicated, and
  keep the author's casing. No field has a length or count cap.
- Overview is a preset-level rail entry above the prompt groups, and the first entry in the mobile selector.
  It does not render for a built-in preset.
- Field order: Author, Description, Tags, Models. The description uses the markdown prompt field. Tags and
  Models use the existing free-form chip input with an empty suggestion list. The world tag vocabulary is
  not used.
- A duplicated preset keeps the Overview.
- The screen gets a dev-router entry.
- Help copy follows the settings copy rules. Run the copy sweep on the new labels and hints.

Tickets 03 and 10 add suggestions to Tags and Models. Give the two fields a suggestion-list input so those
tickets only supply data.

## Acceptance criteria

- [ ] A user preset shows the Overview rail entry first; a built-in preset shows none, on desktop and mobile
- [ ] Each field writes through to the stored preset and survives a reload
- [ ] The setter on a built-in preset changes nothing (context-level test)
- [ ] Tags store lowercased and de-duplicated; models keep casing and de-duplicate
- [ ] Duplicate copies the Overview
- [ ] An old stored preset with no `overview` loads unchanged
- [ ] Dev-router entry exists and the drift-guard test is green
- [ ] A rendered test covers: entry absent for built-ins, fields write through
- [ ] UI checked in the preview at desktop and mobile width, both themes
- [ ] Changelog In-Progress entry added; four gates green
