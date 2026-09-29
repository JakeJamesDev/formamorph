# 05: Hidden traits

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: small logic on top of Always On; the work is a sweep of every player-facing surface for leaks.

Parent: [Trait Modes and Pick Counts spec](../spec.md)

## What to build

An author can mark a trait Hidden. Hidden is Always On that the player never sees (Q13). The AI sees it like any active trait, with no marker and no prompt change (Q19). Its stat changes apply (Q4). Its name shows only in dev and debug tools, the Prompt viewer and Test Bench (Q20). A visible locked trait's gate line leaves out hidden requirements, and reads "Locked" when every requirement is hidden (Q14).

## Acceptance criteria

- [ ] `mode: 'hidden'` behaves exactly like `alwaysOn` in the gate module and the pick counts.
- [ ] The trait editor's mode control gains Hidden.
- [ ] The setup list and the Traits tab never show a Hidden trait.
- [ ] An Enter World category with no visible rows is not shown. This covers categories that hold only Hidden or dormant Always On traits (Q33). The page index may move as picks change.
- [ ] Gate lines leave out hidden targets and read "Locked" when none remain.
- [ ] Every player-facing surface that names traits leaves out Hidden traits. This covers history, stat change attribution and cascade banners. The ticket's comments list each surface checked.
- [ ] AI context, the Prompt viewer and Test Bench still show Hidden traits.
- [ ] Tests: absence on the setup list and the Traits tab; the gate-line filter and the bare "Locked"; the trait present in built AI context. Each guard is shown to bite.
- [ ] The changelog line is in In Progress.
