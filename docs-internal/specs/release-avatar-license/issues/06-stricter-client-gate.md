# 06: Stricter Client Gate

Status: ready-for-agent
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

- [ ] Every requirement passing, each failing alone and named, and each missing field failing are tested.
- [ ] Client and server reject the same files with the same identifiers, using a shared vector.
- [ ] Each new identifier produces its own words, and a file with no VRM 1.0 metadata keeps the single format sentence.
- [ ] An old library record is read again, and a current one isn't.
- [ ] The shipped-file test passes on Sei and Aki, and fails on the Elaina file from history. Record that run in the Landed notes.
- [ ] A restricted file shows the refusal before the publish modal opens.
- [ ] A changelog fragment is added.
- [ ] Frame: `.scratch/frames/not-shareable.png`, a restricted model's reasons in the Model Library at 1366, light theme.

The response must carry the export-shape reminder: stored model records and the Avatar listing's `license` content gain fields.

For you: the refusal wording, in the frame above.
