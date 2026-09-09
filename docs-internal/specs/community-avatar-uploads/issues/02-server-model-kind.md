# 02: Server: `model` kind with the license gate

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Model rationale: a contained server change with a small binary-parsing port and a route-test suite in an established style; the gate's rules are fully specified.

## Parent

[spec.md](../spec.md) — Community Avatar Uploads. Work lands in FormamorphServer.

## What to build

FormamorphServer accepts a fourth listing kind, `model` (an Avatar). Publishing one sends the existing kind-agnostic body with `contentData = { vrm: <data URL of the .vrm bytes>, license: <normalized license>, hash: <content hash> }`. On create and update the server decodes the data URL, parses only the GLB header and JSON chunk, normalizes the VRM 1.0 meta, and runs the Permissive License gate. A passing file is stored verbatim like any other kind's content. A failing file is a 400 whose body lists the failed requirements by stable identifier. The client-sent `license` field is never trusted for enforcement.

Gate requirements, all required: metadata is VRM 1.0; `avatarPermission === 'everyone'`; `allowRedistribution === true`; `modification === 'allowModificationRedistribution'`; `commercialUsage` is `personalProfit` or `corporation`. A missing field fails its requirement. VRM 0.0 files and plain glTF files fail.

Kind rules: no description required, no thumbnail required (a placeholder is filled — reuse the entity placeholder image until Avatar art exists), `maxContentBytes` 64MB. Every kind-agnostic rule applies unchanged: ownership, suspension, upload terms, quarantine visibility, contest-lock non-applicability, comments, likes, changelog, reports, cascade delete.

The requirement identifiers are the contract with the client's copy; record them in the kinds config and keep them stable.

## Acceptance criteria

- [ ] `KINDS` includes `model`; kind and kind-validation drift assertions updated.
- [ ] Create and update with a passing VRM 1.0 file succeed and store the content verbatim.
- [ ] Each requirement failing alone yields a 400 naming that requirement; a VRM 0.0 file and a plain glTF yield a 400.
- [ ] Content over 64MB is refused; a missing thumbnail is filled with the placeholder.
- [ ] Only the GLB header and JSON chunk are read; the binary chunk is never decoded.
- [ ] List and single-listing reads return `model` rows; an unnamed kind still returns worlds only.
- [ ] Ownership, quarantine, comments, likes, changelog, and reports behave for `model` exactly as for other kinds (route tests in the existing style, prior art the kind and contest-entries suites).
- [ ] Both bundled Formamorph avatars pass the gate when sent as fixtures.
- [ ] Server test suite green.
