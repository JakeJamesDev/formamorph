# 02: Hide contest counts in like replies

Status: ready-for-human
Base: c4b7873b
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Response contract, Routes)

Model rationale: reuses ticket 01's rule on two routes, but the guest-like route has several early-return paths that each carry a count.

## What to build

A player likes or unlikes a hidden contest entry, and the reply confirms the like without the count. Liking and unliking can no longer reveal the number. The reply keeps its `data` envelope, so old clients settle at "0" without an error.

## Acceptance criteria

- [x] The account like reply follows the contract: `{liked, likesHidden: true}` for a hidden count, and `likes` otherwise.
- [x] The guest-like reply follows the same contract on every path: a normal press, the path that answers when the feature is off, and the path for an Install whose claiming account already likes the listing.
- [x] Every reply keeps its `data` envelope.
- [x] Staff like-removal replies are unchanged.
- [x] Route tests cover each path for a hidden and a visible entry. Each guard bites when its path is reverted.
- [x] Server gates green.
