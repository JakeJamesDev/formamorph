# 07: Make Editor Architecture and Editorial Checks Meaningful

Status: ready-for-agent

**Parent:** [Test Suite Efficiency and Trust](../spec.md)

**Blocked by:** None (can start immediately).

## What to Build

Editor checks enforce intentional architecture and editorial rules without pinning incidental source spelling or claiming unmeasured layout behavior. Shared FullscreenShell reuse remains required; copy rules remain blocking.

Address the identified fullscreen, viewport sizing, changelog typography, and settings-copy checks. Preserve meaningful contracts and the editor's caption consistency rules rather than removing structural checks as a category.

## Acceptance Criteria

- [ ] The shared-shell check detects a covered surface bypassing the shell and does not accept an unused import as evidence of reuse.
- [ ] Equivalent source syntax, such as an import alias, does not fail solely because a component or hook is spelled differently. Keep legitimate existing fullscreen exceptions intentional.
- [ ] User-facing fullscreen semantics are checked separately through real rendered behavior where the environment can prove them.
- [ ] Retain intentional viewport, theme/background, and font-role contracts; replace incidental regex constraints where practical and accurately label source-level evidence.
- [ ] Keep intentional title-case, sentence, and description-length rules as lightweight blocking editorial checks. Test names and reports no longer present word counts as proof of on-screen fit.
- [ ] Architectural and editorial checks can be selected independently and remain included in the aggregate completion gate. Supply filesystem-dependency mappings or group inclusion rules for ticket 09.
- [ ] Demonstrate that breaking each repaired contract triggers the intended check, while an equivalent allowed representation remains valid. Restore and verify all temporary mutations.
- [ ] Measure coverage on any production module changed for testability. Do not change product copy or design rules merely to simplify checks.
- [ ] Complete typecheck, lint, the full test suite, and build; report test wall time and exit status. Update the developer-tooling changelog and code graph as applicable.

## Coordination

This ticket can begin with the existing runner. If ticket 01 is changing grouping concurrently, coordinate registration instead of independently rewriting shared configuration. Browser layout verification remains with the separate Playwright effort; name any evidence deferred there.
