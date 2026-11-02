# 01: Stricter Server Gate

Status: ready-for-agent
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

- [ ] A file that meets every requirement passes on create and on file update.
- [ ] Each new requirement fails alone and is named in the error body, tested once per requirement.
- [ ] Each new field fails when missing.
- [ ] `commercialUsage: personalProfit` fails.
- [ ] Reinstating the old `commercialUsage` check and dropping one new requirement each turn a test red.
- [ ] A file with no VRM 1.0 metadata keeps its current refusal.

The server deploy is the user's step.

For you: deploy the server before the first release that carries these tickets.
