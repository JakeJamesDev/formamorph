# 04: Test Bench gate rules

Status: ready-for-human
Status note: built in 249439f5 and 9faec08a; notes for later tickets under Comments.
Base: 8c74e005
Blocked by: 01 — Gate module and enter-world gates
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: three data-shaped rules with the pin rules as prior art; the detection already lives in the gate module.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

The Test Bench tells an author when a gate can never open, points at nothing, or keeps a default from starting selected.

## Acceptance criteria

- [ ] An error rule lists each never-unlockable set and its members, from the gate module's detection. A loop that opens through a third trait is no finding.
- [ ] An error rule lists each requirement that points at a deleted trait, group, or entity, with the stored name.
- [ ] A warning rule flags a default trait whose requirement is not met by the other defaults, and says why it does not start selected.
- [ ] Rule tests cover each finding and its absence, and each guard fails when its rule is removed.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.

## Comments

**Hand-over (2026-09-26).** The rules sit in `src/lib/testBench/rules.ts` under "Trait gates": `trait-requirement-never-unlockable`, `trait-requirement-unresolved` and `trait-default-gated`. All three are Simple-visible.

- **Ticket 06 (owned traits):** `gateReportOf` builds the gate input from world traits only, through `worldGateInput`. Add every entity owner there, or the rules miss owned traits.
- **Messages quote the gate module's requirement text**, so a finding reads like the Requires chip. A nameless target reads "undefined", because `requirementText` in `traitGates.ts` has no fallback for a missing `name`. That also shows on the editor chip and the in-play lock line.
- **Not wired:** the Test Bench lens still reads raw `isDefault`, not `settleDefaults`.
- **Flaky under load:** `MainMenu.entry.test.tsx` "retains dictionary order and explicit none through Avatar…" failed once in a full run and passed alone (31/31).
