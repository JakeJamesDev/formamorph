# 01: Stricter Server Gate

Status: done
Base: da09679
Blocked by: None (can start immediately)
Repo: FormamorphServer
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A contained change to one pure module and its meta reader. The identifiers set here are the contract for ticket 06.

## What to build

The community server refuses an Avatar file whose license adds any restriction, on create and on file update. The refusal names every failed requirement, so an API client learns what the file's terms prevent.

The server's VRM meta reader reads the four expression flags, `creditNotation`, `licenseUrl` and `otherLicenseUrl`. The gate adds the requirements listed in the spec's Permissive License gate section, and `commercialUsage` tightens to `corporation`. A missing field fails its requirement. Identifiers are append-only, and the existing five keep their names.

This ticket owns the new identifier names. Ticket 06 uses the same names on the client.

Rulings: Q4, Q7, Q11.

## Acceptance criteria

- [x] A file that meets every requirement passes on create and on file update. (`modelKind.test.js`: creates a model listing; updates an existing listing)
- [x] Each new requirement fails alone and is named in the error body, tested once per requirement. (`modelKind.test.js` create and update loops over `BREAKS`; `vrmLicenseGate.test.js` per-requirement loop)
- [x] Each new field fails when missing. (`vrmLicenseGate.test.js` missing-field loop; `otherLicenseUrl` is excluded by ruling, absent and empty pass)
- [x] `commercialUsage: personalProfit` fails. (`refuses personalProfit commercial use`, in both test files)
- [x] Reinstating the old `commercialUsage` check and dropping one new requirement each turn a test red. (mutation runs: 2 red for the old check, 7 red for dropping `licenseUrl`)
- [x] A file with no VRM 1.0 metadata keeps its current refusal. (VRM 0.0 and plain glTF tests; they fail every requirement except `otherLicenseUrl`, where absence passes)

## Landed

**Not verified**

- The alternate-avatar row of `the bundled Formamorph avatars` in `tests/modelKind.test.js` is expected red once the client checkout is a sibling. It is skipped inside a worktree, so the gates never ran it. Run directly on the real files, the gate passes `public/default-avatar.vrm` and fails `build-assets/alternate-avatar.vrm` (Elaina) on exactly the four flag requirements: `allowExcessivelySexualUsage`, `allowExcessivelyViolentUsage`, `allowPoliticalOrReligiousUsage`, `allowAntisocialOrHateUsage`. Ticket 04 puts Sei at that path.
- `otherLicenseUrl: null` fails the gate, because only an absent field or `""` passes. No test covers `null`.
- `tests/eventsAdmin.test.js` "refuses a zero-length window" failed once in a full run and passed alone and in the later gate run. It looks flaky under load and is unrelated.

**For you**

- Deploy the server before the first release that carries these tickets.
- Export shape: the stored model record and the Avatar listing's `license` content gain `allowExcessivelySexualUsage`, `allowExcessivelyViolentUsage`, `allowPoliticalOrReligiousUsage`, `allowAntisocialOrHateUsage`, `creditNotation` and `otherLicenseUrl`.

The server deploy is the user's step.

For you: deploy the server before the first release that carries these tickets.
