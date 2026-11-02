# 08: Server Fingerprints

Status: done
Base: 0541624
Blocked by: 04, 05, 06
Repo: FormamorphServer
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

A copy of a generated list, with its existing test as the guard.

## What to build

The server recognizes the unedited Sei, Aki and Praline files as bundled, and refuses to publish them as community Avatars. The client's generated fingerprint list is copied to the server. Elaina's hash stays in the list.

This ticket also copies ticket 06's license vector byte for byte to the server's test fixtures, and runs it through the server's meta reader and gate. Client and server then reject the same files with the same identifiers.

Rulings: Q4, Q7.

## Acceptance criteria

- [x] The server's avatar list equals the client's, compared by test or by a recorded diff. (whole file copied; `cmp` shows it identical to the client's `src/lib/bundledFingerprints.json`)
- [x] A test refuses each of the three new hashes and passes an edited file. (`bundledFingerprint.test.js`, "the shipped default Avatar list"; the edited-file row reads the real files and is skipped in a worktree)
- [x] Elaina's hash is still refused. (the test pins all 5 earlier hashes; the list does not say which is Elaina's)
- [x] The server's copy of the license vector matches the client's, and a server test runs every case. Changing one expected identifier turns it red. (`avatarLicenseVector.test.js`, 29 cases; `cmp` identical; mutated one `failed` list, 1 test went red)

For you: deploy the server before the first release that carries these tickets.

## Landed

**Verified**

- The server's earlier hashes are all in the client file: 5 of 5 avatars and 117 of 117 worlds. The copy adds 3 avatar hashes (Sei, Aki, Praline) and 13 world hashes.
- `sha256sum` of the client's three real Avatar files gives exactly the three new avatar hashes.

**Not verified**

- The real-file rows (`bundledFingerprint.test.js` edited-file check, and the Praline row in `modelKind.test.js`) are skipped inside a worktree. They run once the client is a sibling checkout.
- Which of the 5 earlier hashes is Elaina's. The test pins all 5 together.

**For you**

- Deploy the server before the first release that carries these tickets.
