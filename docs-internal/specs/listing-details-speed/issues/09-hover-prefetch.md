# 09: Guarded hover prefetch

Status: ready-for-human
Base: 8117c4ae
Blocked by: 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Timing, cancellation, and request sharing between prefetch and open; needs fake-timer tests that bite.

## What to build

Spec Q6. Resting the pointer on a community card for about 150 ms, or focusing it with the keyboard, starts loading that listing. A sweep across cards sends nothing. Touch never prefetches. A new prefetch cancels the one before it. A listing already cached in this visit is not prefetched. The prefetch fills the details cache and holds the first comments page in memory for the next open. An open that finds a prefetch in flight waits for it instead of sending its own request.

## Acceptance criteria

- [ ] Dwell under the threshold sends nothing; dwell over it sends one prefetch.
- [ ] Keyboard focus prefetches; a touch pointer does not.
- [ ] A second prefetch cancels the first.
- [ ] An open during a prefetch sends no duplicate request.
- [ ] It works the same in the app and on the website.
- [ ] Tests at the card or browser seam with fake timers cover each rule and fail when it is removed.

## Comments

- The dwell lives in `useListingPrefetch`, and the loader owns one prefetch slot, the visit set, and reuse (Q6a).
- A failed prefetch never stands in for the open. Pointer and keyboard dwells keep separate timers.
- The open-reuses-prefetch rule is tested at the loader and details window seams, not the browser. The card is the same on the app and the website, so no site test was added.
- Gap: a card can't be opened from the keyboard. Ticket 10 (Q12) covers it; its title button starts the dwell with no change here.
- Open: hovering a card in the dev-router Design System showcase sends real requests for its fake ids.
