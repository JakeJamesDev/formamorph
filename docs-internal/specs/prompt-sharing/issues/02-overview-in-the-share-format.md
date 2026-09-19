# 02: Overview in the Share Format

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/prompt-sharing/spec.md`

## What to build

The Overview travels in the `.json` export and in the share code. The import dialog shows it before the
user accepts.

- The shared preset artifact gains an optional `overview` block with the same four fields. The format
  version stays at 1. A payload with no Overview still imports.
- The share builder keeps its explicit field list. It writes `overview` only when a field has content.
- Import validates types only. A string stays, a string array keeps its string members, everything else
  drops. No truncation. Import applies the same tag and model normalization as ticket 01.
- The import dialog preview shows author, description (rendered markdown), tags, and models when present.
  The name, warnings, tuning, and collision controls stay as they are.
- Export of a built-in preset carries no Overview.

**This changes a released share format.** Say so in the hand-over message. Do not bump any version and do
not add a migration.

## Acceptance criteria

- [ ] Round trip through file and through share code keeps all four fields
- [ ] Wrong types drop field by field; the import still succeeds
- [ ] A payload from before this change imports with no Overview and no new warning
- [ ] Endpoint routing never appears in the built artifact (existing guard still green)
- [ ] The import preview shows the Overview; a rendered test covers it
- [ ] Each new guard test is proven once by putting the bug back
- [ ] The hand-over message states the share format change
- [ ] Changelog In-Progress entry added; four gates green
