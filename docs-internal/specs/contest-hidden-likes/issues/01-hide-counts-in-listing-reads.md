# 01: Hide contest counts in listing reads

Status: ready-for-human
Base: 53a24ffb
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › The hidden-count rule, Response contract, Routes, Caching)

Model rationale: one rule threaded through six read paths, the likes sort, and a cache header. A missed path is a silent leak.

## What to build

A guest or another account reads the catalog or any listing view during a contest, and entries carry no count. Instead they carry `likesHidden: true`. The entry's author and staff get the count plus `likesPrivate: true`. Once staff announce results, or the entry is withdrawn, or the contest is canceled, everyone gets the plain count again.

One server function decides whether a count is hidden. Every read path below uses it.

## Acceptance criteria

- [ ] One function decides "hidden for this reader" from the listing's contest link, the contest's announced-results time, the author, and the reader. No route repeats the rule.
- [ ] Catalog: hidden rows leave out `likes` and carry `likesHidden: true`. Rows the author or staff see through the rule carry `likesPrivate: true`.
- [ ] Catalog `sort=likes` orders a hidden count as 0 for that reader. A test gives a hidden entry many likes and asserts that it sorts with the zero-like rows for a public reader.
- [ ] The single listing, listing content, the dependency list, dependency content, and the add-on list follow the same contract. The content read receives the reader.
- [ ] Publish and update replies follow the contract (the author sees the count).
- [ ] The single listing read sends `Cache-Control: private, no-cache` and varies on Authorization and the install header. A test asserts this.
- [ ] `liked` is unchanged on every path.
- [ ] A route test table runs reader (guest, other account, author, staff) × contest state (live, judging, results announced, withdrawn, canceled) against each path above.
- [ ] Each guard bites. Dropping the reader from the content read makes a test fail.
- [ ] Server gates green.
