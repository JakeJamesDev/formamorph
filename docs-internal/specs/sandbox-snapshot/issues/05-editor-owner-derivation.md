# 05: Editor Owner Derivation

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

The editor's two remaining copies of "which Owner does this box run under" read the snapshot's derivation. Ruling Q11.

## What to build

An author edits a Script and sees the same completions, diagnostics and Find All Uses results as before. Behind it, the script entry context and Find All Uses take the box's Owner from the snapshot module's exported derivation instead of computing it themselves. The Blueprint rule that leaves `owner.stats` names unchecked keeps its current home and reads the derived Owner.

## Acceptance criteria

- [ ] The script entry context reads the box's Owner through the snapshot module's derivation. Its own mapping is deleted.
- [ ] Find All Uses reads each box's Owner through the same derivation. Its own mapping is deleted.
- [ ] The Blueprint `owner.stats` unchecked rule still applies, now from the derived Owner.
- [ ] Existing editor, code-insert and Find All Uses tests stay green with no assertion change.
- [ ] Four gates green, exit codes read.
