# 07: Publish a Preset

Status: ready-for-agent
Blocked by: 02, 04, 06
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: `docs-internal/specs/prompt-sharing/spec.md`

## What to build

An author publishes a user preset to the community catalog from the Prompts screen, as a new listing or as
an update to one of their own.

- A stored user preset gains the local-only community link that library items use: source id, source
  updated stamp, source author id and name, downloaded stamp, dirty flag, edited stamp. It never enters the
  share artifact. Add a guard test beside the routing guard.
- An edit to a linked preset's prompt text, tuning, or Overview sets dirty and the edited stamp. A
  duplicated preset has no link. Deleting a preset drops its link.
- A new payload builder maps the preset to the publish payload: name from the preset name, description and
  tags from the Overview, `models` as a new payload field, content from the shared preset artifact. Tuning
  is always present. The size check uses the `prompt` limit.
- Desktop: a Publish button beside Export. Mobile: a Publish item after Export in the overflow menu.
  Neither renders for a built-in preset.
- The publish dialog handles the kind. It shows the changelog and compatible worlds sections. It does not
  show contest entry, linked content, or the remote-image warning. The policy and terms gate applies.
- Publish is blocked while Models is empty. The message names the Overview field and offers to open it.
- New versus overwrite is the author's choice each time, from their own `prompt` listings. After a
  successful publish the local preset links to the listing.

## Acceptance criteria

- [ ] Payload builder tests: Overview mapping, tuning present, routing and link absent, models-required gate
- [ ] Guard test: the community link never appears in the file or share code
- [ ] Context tests: edit sets dirty, duplicate drops the link, delete drops the link
- [ ] Publish as new and publish as overwrite both work against the dev server
- [ ] The listing shows in the Prompts section with the right description, tags, and models
- [ ] The local preset holds the listing id and stamp after publish
- [ ] Publish is absent for built-ins on desktop and in the mobile menu
- [ ] The empty-Models block shows and leads to the Overview
- [ ] Changelog In-Progress entry added; four gates green
