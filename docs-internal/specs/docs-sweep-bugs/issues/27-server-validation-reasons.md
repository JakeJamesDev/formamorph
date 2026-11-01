# 27: Failed Publishes and Passwords Show the Server's Reason

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one shared reader, proven through the surfaces that use it.

## What to build

A failed world publish reads "Failed to publish", and a short password reads "Failed to reset the password" or "Failed to change password". The server gives the reason, such as "Thumbnail is required", in an `errors` array of `{ msg }`. The shared response reader takes its reason only from `error` and `message`, so it falls back to the generic line. Ruling Q22: the reader also takes the reason from that array, and several reasons show together on one line.

Check that each password path uses the shared reader. A path with its own reader gets the same result.

Spec: Q22. Evidence: the error audit after this spec's close.

## Acceptance criteria

- [x] A shared-reader test with an `errors` array fails today (the fallback), then passes with the server's reason (`responseError.test.ts`; failed with the fallback line removed)
- [x] Two reasons both reach the message (test: "shows several reasons together")
- [x] A body with `error` or `message` keeps today's result, and an empty `errors` array keeps the fallback (tests: "keeps error and message ahead of the array", "keeps the fallback for an empty array")
- [x] The Publish dialog shows "Thumbnail is required" for a world with no thumbnail (`PublishModal.serverReason.test.tsx`, real `publishItem` with a mocked fetch)
- [x] Password reset and password change each show the server's length rule (`AuthService.test.ts`; both paths already use the shared reader)
- [x] A changelog fragment under Minor / Fixed / 👤 (`docs-internal/changelog.d/server-validation-reasons.md`)

## Landed

**Not verified**
- A live run against the server. The `errors: [{ msg }]` shape and the password text come from the FormamorphServer route validators (`routes/auth.js`, `routes/worlds.js`); no request was sent. The change-password controller also answers a plain `error` on one branch, which the reader already handled.

**For you**
- Publish a world with no thumbnail: the Publish dialog should name the missing thumbnail.
- Reset or change a password to a short one: the form should show the length rule.
