# 06: Stricter Client Gate

Status: ready-for-human
Blocked by: 01, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Mirrors ticket 01 on the client, plus copy. The stale-license move is the one part that can go wrong silently.

## What to build

A publisher learns before the publish modal opens that a restricted file can't be published, and the refusal names each failed requirement. The Model Library shows why a model is Not Shareable.

The client gate uses the identifiers from ticket 01. The normalized VRM license type gains the four flags, the credit field as read, and `otherLicenseUrl`. Both client copy tables get an entry for each new identifier. Write that copy from the Writing Guide.

The library's stale-license check moves to a field only new records carry, so old records are read again and judged on their real terms. The shipped-file test keeps its rows and now holds them to the stricter gate. Never narrow it.

Rulings: Q4, Q7, Q11.

## Acceptance criteria

- [x] Every requirement passing, each failing alone and named, and each missing field failing are tested. (`avatarLicenseGate.test.ts` single-failure and `requiredFields` tables; vector cases)
- [x] Client and server reject the same files with the same identifiers, using a shared vector. (client half: `avatarLicenseGate.vector.test.ts` runs `__fixtures__/avatar-license-vector.json`; expected lists came from the server gate's real output; the server copy is ticket 08)
- [x] Each new identifier produces its own words, and a file with no VRM 1.0 metadata keeps the single format sentence. (`avatarPublish.test.ts`; `ModelDetailsPanel.test.tsx` names each reason)
- [x] An old library record is read again, and a current one isn't. (`ModelStorageService.test.ts`, both cases)
- [x] The shipped-file test passes on Sei and Aki, and fails on the Elaina file from history. Record that run in the Landed notes. (see Landed)
- [x] A restricted file shows the refusal before the publish modal opens. (`publishModel` in `MainMenu.tsx` calls `buildAvatarPublish` first; `avatarPublish.test.ts` refusal cases)
- [x] A changelog fragment is added. (`docs-internal/changelog.d/release-avatar-license-06.md`)
- [x] Frame: `.scratch/frames/not-shareable.png`, a restricted model's reasons in the Model Library at 1366, light theme. (details panel via the dev router)

The response must carry the export-shape reminder: stored model records and the Avatar listing's `license` content gain fields.

For you: the refusal wording, in the frame above.

## Landed

**Verified**

- The shipped-file test passes on the Sei and Aki files. Run against the Elaina file from `af995795a`, the same gate returns `allowed: false` on exactly the four expression flags. The temporary test and file are gone.
- Mutation runs: reinstating the old `commercialUsage` check turns 3 tests red. Dropping the `licenseUrl` check turns 9 red.
- The vector's expected lists come from the server gate's real output and match the client's, including `otherLicenseUrl: null` failing and absent or `""` passing.

**Not verified**

- The server half of the shared vector. Ticket 08 copies the file byte for byte and adds the server test. Until then, parity was checked once against the server gate's output, not on every run.
- A non-string `otherLicenseUrl` such as `5` has no vector case. Both sides fail it.
- A file with no VRM metadata at all has no `allowExcessivelySexualUsage` key, so the stale check re-reads it each time. This predates the ticket.

**For you**

- Export shape: the stored model record and the Avatar listing's `license` content gain `allowExcessivelySexualUsage`, `allowExcessivelyViolentUsage`, `allowPoliticalOrReligiousUsage`, `allowAntisocialOrHateUsage`, `creditNotation` and `otherLicenseUrl`.
- The refusal wording, in `.scratch/release-avatar-license-06/frames/not-shareable.png`. Two refusal phrases read stiffly: "use without extra license terms" and "use under the VRM Public License 1.0 alone".
- The client gate now fails every requirement for a file without VRM 1.0 metadata, as the server does. Before, a VRM 0.0 file with a CC license passed `allowRedistribution`.
