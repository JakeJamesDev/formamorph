# Spec: Feedback List Search and Filters

Status: ready-for-agent
Spec session: feedback-list-filters — spec

## Problem Statement

Staff and users browse Bugs and Suggestions in paged lists. Staff use the Admin Panel queues. Users use the Feedback dialog tabs.

- No one can search. To find a thread, a reader pages through the list.
- Users cannot filter by triage status. They see open, done, and declined threads mixed together.
- The filter row holds every dropdown at full width. It wraps on narrow windows, and the controls a reader uses most have the same weight as the rest.
- Back from a thread always returns to page 1. A reader who works through page 4 must page forward again after each thread.
- Staff Suggestions opens on every status, and users have no status default. Closed threads fill the first pages.
- Bugs has no sort. Staff cannot find the oldest reports or the reports with recent activity.

## Solution

Every feedback list gets a search bar that matches title and body as you type. Users get the same status filter as staff. Every list opens on the threads that still need work: **Still Open** for Suggestions, **Unresolved** for Bugs.

The filter row shows only the controls each reader uses most. Staff see search, Status, and Sort. Users see search, the Mine / Everyone's scope, and the file button. Every other control moves into a hidden-filters control. That control shows a badge when a hidden filter differs from its default, and it offers a Reset. A prototype settles the look before the build.

Bugs and Suggestions share one sort list: Newest, Oldest, and Recently active, plus Most voted on Suggestions. Users get Sort on every tab and scope.

Back from a thread returns to the same page and scroll position. Search, filters, and page survive Back and tab switches. Closing the dialog resets them.

The server adds text search, multi-status filtering in one request, and the new sorts. These changes deploy before the client changes.

## User Stories

1. As a user, I want to search feedback by words in the title or body, so that I can find a thread without paging.
2. As a staff member, I want to search the queue by title or body, so that I can find a report a user mentions.
3. As a reader, I want the search to run as I type, so that I don't need to press Enter.
4. As a reader, I want the search to wait for a short pause in typing, so that each keystroke does not send a request.
5. As a reader, I want a clear button on the search bar, so that I can return to the full list in one click.
6. As a reader, I want a new search to start on page 1, so that I don't land on an empty page.
7. As a reader, I want a search that matches nothing to say so, so that I know the list is not still loading.
8. As a user, I want a status filter on Bugs, so that I can hide reports that are resolved or won't be fixed.
9. As a user, I want a status filter on Suggestions, so that I can see only what is planned or still open.
10. As a user, I want the same status options as staff, so that one vocabulary describes triage everywhere.
11. As a user, I want to pick one status, such as Planned, so that I can see what the team committed to.
12. As a reader, I want Suggestions to open on Still Open, so that I see what can still change first.
13. As a reader, I want Bugs to open on Unresolved, so that I see the reports nobody has fixed first.
14. As a user, I want my own list to open on the same default, so that both scopes act the same way.
15. As a user, I want to pick All when I need it, so that I can still find my closed threads.
16. As a staff member, I want Status and Sort always visible, so that I triage without opening a menu.
17. As a user, I want the scope and the file button always visible, so that I can switch lists and file in one click.
18. As a reader, I want less-used filters in a hidden-filters control, so that the row fits a narrow window.
19. As a reader, I want a badge on the hidden-filters control when a hidden filter differs from its default, so that I know the list is narrowed.
20. As a reader, I want no badge when every hidden filter is at its default, so that the badge means something.
21. As a reader, I want a Reset in the hidden filters, so that I can return every filter to its default at once.
22. As a staff member, I want to sort Bugs by Oldest, so that I can find reports that have waited longest.
23. As a staff member, I want to sort Bugs by Recently active, so that I can see where a reply or status change just happened.
24. As a reader, I want the same sorts on Suggestions, plus Most voted, so that both tabs work the same way.
25. As a user, I want Sort on Bugs and on my own list, so that I can order any list I see.
26. As a staff member, I want Suggestions to keep opening on Most voted, so that I see what users want most.
27. As a user, I want Suggestions to keep opening on Newest, so that I see what is new to vote on.
28. As a reader, I want Back from a thread to return to the page I came from, so that I don't page forward again.
29. As a reader, I want Back to restore my scroll position, so that I land on the row I opened.
30. As a staff member, I want Back to land on the last page when my triage moved the thread out and the page no longer exists, so that I never see an empty page.
31. As a reader, I want search, filters, and page to survive a switch between Bugs and Suggestions, so that I don't lose my place.
32. As a reader, I want the dialog to open on defaults each time, so that an old search does not hide threads.
33. As a reader, I want a list filtered to Still Open or Unresolved to be complete on every page, so that no thread is missing.
34. As a staff member, I want the queue to stay fast with search and several statuses, so that triage does not wait on requests.

## Implementation Decisions

Rulings from the grilling session:

| # | Ruling |
|---|---|
| Q1 | Search matches title and body. |
| Q2 | The list endpoint accepts several statuses in one request. |
| Q3 | Users get the same status options as staff: All, Still Open or Unresolved, then each state. |
| Q4 | Still Open (Suggestions) and Unresolved (Bugs) are the default on every list, including a user's own. |
| Q5 | Back restores page and scroll. A page past the end clamps to the last page. |
| Q6 | The layout is prototyped first. The user picks one before the build. |
| Q7 | Staff always see search, Status, and Sort. |
| Q8 | Users always see search and the scope. The file button stays visible. |
| Q9 | Search runs as you type, after a short pause. It resets to page 1 and has a clear button. |
| Q10 | Bugs gets a sort. |
| Q11 | The hidden-filters badge shows only when a hidden filter differs from its default. Reset returns all filters to defaults. |
| Q12 | Back and tab switches keep search, filters, and page. Closing the dialog resets them. |
| Q13 | Bugs offers Newest, Oldest, and Recently active. Newest is the Bugs default. |
| Q14 | Suggestions share that list and add Most voted. |
| Q15 | Users get Sort on every tab and scope. |
| Q16 | Server tickets land and deploy before client tickets. |
| Q17 | Default sorts stay: staff Suggestions on Most voted, users on Newest, Bugs on Newest. |
| Q18 | The user picked layout A, "One Row, Filters Popover", from the ticket 06 prototype. See Layout. |

### Server

- **List endpoint, search.** `GET /api/feedback` takes an optional search parameter. It matches threads whose title or body contains the text, case-insensitively. Blank or whitespace text is no search. The match escapes the LIKE wildcards, so `%` and `_` match literally. The server trims the text and truncates it to 200 characters; it never rejects a long search. The client input has a maximum length of 200.
- **List endpoint, statuses.** The status parameter accepts a comma-separated list. The server keeps each value that is valid for the type and drops the rest. No valid value means no status filter, as today. A single status works as before.
- **List endpoint, sorts.** The sort whitelist adds `oldest` (created first) and `active` (`updated_at` latest first). Every sort ends on the same newest tiebreak. `votes` stays valid for Suggestions only; on Bugs it falls back to newest. An unknown sort falls back to newest, as today.
- `total` counts every thread that matches all filters, so paging stays exact.
- Search, statuses, category, scope, and sort combine with AND.
- The response shape does not change.

### Client

- **FeedbackService.list** sends the search text and the status list in one request. The per-status fan-out and its `truncated` result go away, and so does the list's incomplete-page warning.
- **Presentation module.** One sort list with labels for Newest, Oldest, Recently active, and Most voted. A per-type function gives the sorts each type offers. The status options, the Still Open / Unresolved labels, and the defaults stay in this module, so both tabs read one source.
- **List state moves up.** The page moves out of FeedbackList into the tab that owns the filters. FeedbackList takes the page and reports page changes. The tab keeps the page while a thread is open, so Back returns to it. The tab also records the list's scroll position when a thread opens and restores it on Back.
- **Clamp.** When a reload returns a page past the end, the list moves to the last page.
- **Reset on change.** A change to search, status, category, scope, or sort sets page 1, as a filter change does today.
- **Debounce.** The search input updates the request after a short pause. Clearing the input applies at once.
- **Lifetime.** Each tab owns its own search, filters, and page. The tabs stay mounted while the dialog or Admin Panel is open, so a tab switch keeps them. This includes the Admin Panel's outer tabs: Feedback → Reports → Feedback keeps the staff queue's state, and a hidden queue sends no requests. Closing unmounts them, so the next open starts on defaults.
- **Staff queue tab.** Defaults: Unresolved or Still Open, any category, Newest on Bugs, Most voted on Suggestions. Visible: search, Status, Sort. Hidden: Category.
- **User tab.** Defaults: the current scope default, Unresolved or Still Open, any category, Newest. Visible: search, scope, file button. Hidden: Status, Category, Sort.
- **Empty labels.** On the user tab, a set search shows a "No reports match this search." style label. Without a search, a status filter other than All shows the "No reports match this filter." style label. At All, the tab keeps its "nothing yet" labels. The staff queue keeps its "match this filter" labels.
- **Hidden filters.** One control per tab holds the hidden filters. A badge shows the number of hidden filters that differ from their defaults. Reset returns every filter to its default, the visible ones included: Status, Category, Sort, and the user's scope. Reset leaves the search text alone; the search bar has its own clear button.
- **Layout (Q18, layout A from the ticket 06 prototype).** The user approved it as a new pattern.
  - One row: the search bar grows to fill it, then the visible controls, then a **Filters** button (filter-list icon, "Filters" label, count badge). The user row is search, scope, **Filters**, then the file button.
  - **Filters** opens a popover, aligned to the end and not portaled. It holds the hidden filters as labeled selects, then a divider and a ghost **Reset Filters** button (rotate icon), aligned left. Reset is disabled when every filter is at its default.
  - Below the `sm` breakpoint: search takes its own row. Staff Status and Sort share two equal grid columns. **Filters** becomes icon-only, with the badge on its top-right corner. The user's file button becomes icon-only with a screen-reader label.
  - **Filters** has the accessible name "More Filters", or "More Filters, N changed" when the badge shows.
  - Reference build: branch `prototype/filter-row-layout`, commit `41b8a13a`, the filter row prototype component.
- Copy for the search placeholder, the hidden-filters label, Reset, and the new sort labels follows the writing guide and is AP title case.

## Testing Decisions

A good test exercises behavior through a public seam: it sends a request or renders a tab, then checks what the reader or the server sees. It does not check internal state or call order. Each guard is proved by reinstating its bug and watching the test fail.

Three seams, confirmed with the user:

1. **Server: `GET /api/feedback` over supertest.** Prior art: the server's feedback tests. Cases: search hits title, hits body, misses, ignores case, and treats `%` and `_` literally. A status list returns the union and an exact `total`. Invalid statuses drop. Each sort returns the expected order, with the tiebreak. `votes` on Bugs falls back to newest. Search combines with status, category, and scope.
2. **Client: the staff queue tab and the user tab with `FeedbackService.list` mocked.** Prior art: the existing queue tab, user tab, and filter-wiring tests. Cases: defaults per tab and type; typing searches after the pause and resets the page; clear applies at once; each type offers the right sorts; the user status filter reaches the request; Back returns to the same page and restores the scroll position; a page past the end clamps; the badge counts only filters that differ from defaults; Reset restores every default.
3. **Client: `FeedbackService.list` with fetch mocked.** Only the query string: the search text, the comma-separated status list, and the sort value.

Radix `Select` does not open in jsdom. Tests that need a dropdown pick follow the filter-wiring test's approach. No new end-to-end test.

## Out of Scope

- Search over replies or reporter names.
- Saved searches, or filters that survive closing the dialog.
- A Most replies sort.
- Changes to the thread view, triage controls, voting, or filing.
- Full-text indexing. A LIKE match is enough at the current volume.

## Further Notes

- No world or save export shape changes.
- Server tickets deploy to api.formamorph.ai before the client tickets ship. A client that sends a status list to an old server gets an unfiltered list, so the order matters.
- The staff Suggestions default changes from All to Still Open. The comment that justifies All goes with it.
