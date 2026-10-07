# 06: Full-Storage Save Errors

Status: done
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: error propagation through the data provider into three callers, plus transactional consistency for owned library copies.

## What to build

A save that fails never hangs and never hides its cause (Q4). Every library write rejects on transaction abort or error with the underlying error object. The data provider's save returns the error to its callers instead of a boolean; the World Editor save button, the in-play editor's exit prompt and the Authoring Tour handle it.

A quota error is recognized by name and shows the used and available space from the storage estimate and an Export World action. Other failures keep a general message with View Details. Library copies of owned items are written in the same transaction as the world or only after it succeeds, so a failed save leaves both unchanged. Messages follow the Writing Guide. One changelog fragment, Minor Fixed, 👤.

## Acceptance criteria

- [ ] fake-indexeddb with a quota abort: save rejects with a QuotaExceededError and never stays pending.
- [ ] World Editor bench: a quota failure shows the storage-full message with used and available space and an Export World action that downloads the unsaved world.
- [ ] A non-quota failure shows the general message with View Details.
- [ ] After a failed save, the world and its owned library copies are unchanged in storage.
- [ ] The in-play editor exit prompt and the Authoring Tour show the same error instead of failing silently.
- [ ] Guard bites: removing the abort handler makes the quota test time out (red).
- [ ] Four gates green.
