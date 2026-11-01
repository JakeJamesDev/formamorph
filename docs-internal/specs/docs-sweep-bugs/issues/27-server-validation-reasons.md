# 27: Failed Publishes and Passwords Show the Server's Reason

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one shared reader, proven through the surfaces that use it.

## What to build

A failed world publish reads "Failed to publish", and a short password reads "Failed to reset the password" or "Failed to change password". The server gives the reason, such as "Thumbnail is required", in an `errors` array of `{ msg }`. The shared response reader takes its reason only from `error` and `message`, so it falls back to the generic line. Ruling Q22: the reader also takes the reason from that array, and several reasons show together on one line.

Check that each password path uses the shared reader. A path with its own reader gets the same result.

Spec: Q22. Evidence: the error audit after this spec's close.

## Acceptance criteria

- [ ] A shared-reader test with an `errors` array fails today (the fallback), then passes with the server's reason
- [ ] Two reasons both reach the message (test)
- [ ] A body with `error` or `message` keeps today's result, and an empty `errors` array keeps the fallback (test)
- [ ] The Publish dialog shows "Thumbnail is required" for a world with no thumbnail (test)
- [ ] Password reset and password change each show the server's length rule (test)
- [ ] A changelog fragment under Minor / Fixed / 👤
