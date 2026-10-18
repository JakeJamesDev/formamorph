# 05: Parameter Slot Creates Its Parameter

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: one slot type extended and a draft write from the dialog back to the Tool editor.

## What to build

A Parameter slot declares its type: `{{name:param(<type>)=<default name>}}` (Q14). The picker lists the Tool's Parameters of that type, plus a row that creates one named after the default. Insert adds each missing Parameter to the Tool draft with that name and type, then fills the code. A plain `{{name:param}}` still works and creates a text Parameter. An empty Parameters list no longer blocks Insert. The World Tool built-ins move to the typed form. The Scripts guide documents the typed slot.

Spec: Q14; follow-ups section.

## Acceptance criteria

- [ ] Inserting Roll Dice into a Tool with no Parameters adds a number Parameter with the default name and fills the code with it
- [ ] Picking an existing Parameter adds nothing to the draft
- [ ] The picker lists only Parameters of the slot's type
- [ ] Every World Tool built-in still passes the runs-clean test
- [ ] Changelog fragment written; four gates green
