# Contest Hidden Likes

Status: ready-for-agent
Spec session: contest-hidden-likes — spec

While a contest runs, only staff see every entry's like count, and each author sees their own. Everyone sees the counts once the winners are announced. Designed in a grilling session on 2026-09-30 against the client and the server code. The work spans both repos, and the server part lands first.

## Problem Statement

Today every listing shows its like count to everyone, and contest entries are no different. During a contest, the counts turn the contest into a public scoreboard. Authors and players can see who leads before staff pick the podium. That takes the tension out of the contest and puts pressure on the judges.

Hiding the number only in the contest tab does not work. Contest entries also show in the normal catalog, on profiles, in dependency lists, and in the reply to a like press. The server sends the count to every reader, including old builds, and the client sorts by it locally. A client-only change leaves the count one request away.

Authors still need some feedback. An author who sees nothing cannot tell whether their entry reaches anyone.

## Solution

The server decides who sees a count. A listing's count is **hidden** when all three are true:

- The listing is a contest entry.
- Its contest has no announced results.
- The reader is not the listing's author and not staff.

A hidden count is left out of every response, and the response says it is hidden. Sorting by likes treats a hidden count as 0, so the order shows no rank. Profile totals leave hidden likes out for the public.

New clients show a hidden count as a heart with a dash. A tooltip explains that likes show after the winners are announced. The heart still works, so players can still like an entry. The author and staff see the real number, with a tooltip saying only the author and staff see it until results.

When staff announce results, every count of that contest shows for everyone. A withdrawn entry and the entries of a canceled contest stop being contest entries, so their counts show at once.

Old clients get no count for a hidden entry and show "0". Nothing leaks and nothing breaks.

## User Stories

### Players

1. As a player, I want contest entries to show no like count while the contest runs, so that I judge entries on their own merit.
2. As a player, I want a hidden count to look different from a count of zero, so that I don't think an entry is unloved.
3. As a player, I want a tooltip on the hidden count, so that I know when the counts will show.
4. As a player, I want to like a contest entry while its count is hidden, so that I can still thank the author.
5. As a player, I want my heart to fill when I like a hidden entry, so that I know my like counted.
6. As a player, I want the like reply to keep the count hidden, so that liking and unliking cannot reveal it.
7. As a player, I want contest entries hidden in the normal catalog too, so that the catalog cannot be used to read the contest.
8. As a player sorting the catalog by likes, I want hidden entries to sort as zero, so that the sort order cannot show who leads.
9. As a player, I want the contest tab to shuffle entries while the contest runs and while it is judged, so that the order shows no rank.
10. As a player, I want every count of a contest to show once the winners are announced, so that I can see how the entries did.
11. As a player viewing an author's profile, I want the like total to leave out hidden likes, so that the total cannot reveal an entry's count.
12. As a player, I want hidden counts to stay hidden in dependency and add-on lists, so that no side view reveals them.
13. As a guest, I want a guest like on a hidden entry to work the same as for any listing, so that the heart behaves the same everywhere.
14. As a website visitor, I want the website to hide counts the same way as the app, so that the website is not a way around the rule.

### Authors

15. As an author with a contest entry, I want to see my own entry's count, so that I know how it performs.
16. As an author, I want a tooltip on my count saying only I and staff see it, so that I know other people can't.
17. As an author, I want to see my own full profile total, so that my total does not drop while I enter a contest.
18. As an author, I want no way to see other entries' counts during the contest, so that the contest stays fair for me too.
19. As an author who withdraws an entry, I want its count to show for everyone at once, so that it is a normal listing again.

### Staff

20. As staff, I want to see every entry's count during a contest, so that I can watch for abuse and judge.
21. As staff, I want the same tooltip as authors on counts that others can't see, so that I remember what the public sees.
22. As staff, I want the Podium dialog to keep its standings and tie markers, so that judging works as today.
23. As staff, I want the likers list and audit to work as today on contest entries, so that like moderation is not affected.
24. As staff, I want counts to show for everyone the moment I announce results, so that I have no second step.
25. As staff canceling a contest, I want its entries' counts to show, so that a canceled contest does not keep counts hidden forever.

### Old clients

26. As a player on an old build, I want contest entries to show "0" instead of the real count, so that old builds cannot get around the rule.
27. As a player on an old build, I want liking a hidden entry to work without an error, so that an old build keeps working.
28. As a player on an old build, I want the catalog to keep loading, so that the rule does not force an update.

## Implementation Decisions

### The hidden-count rule (server)

- One server function decides whether a count is hidden for a reader. It takes the listing's contest entry link, the contest's announced-results time, the listing's author, and the reader. Every route that emits a count uses it. No route repeats the rule.
- A count is hidden when the listing has a contest link, the contest has no announced results, and the reader is not the author and not staff.
- The rule applies to every contest. There is no per-contest toggle and no new setting.
- A withdrawn entry has no contest link, so its count shows at once. A canceled contest clears its entries' links, so their counts show at once. The server keeps no memory of a past contest link.
- The rule applies to every listing kind that can be a contest entry.

### Response contract

- When the count is hidden, the listing leaves out `likes` and carries `likesHidden: true`.
- When the reader sees a count that is hidden from others (the author or staff during a contest), the listing carries `likes` and `likesPrivate: true`.
- Otherwise the listing carries `likes` as today, with neither flag.
- `liked` (the reader's own like) is not affected. It is the reader's own state, not a count.
- The like and guest-like replies follow the same contract, and they keep their `data` envelope. Old clients read a missing count as 0 and don't throw.
- The server never sends a false number for a hidden count.

### Routes that must follow the rule

- The catalog, including `sort=likes`. The likes sort orders a hidden count as 0 for that reader, so the row order shows no rank.
- The single listing, the listing content, the dependency list, dependency content, and the add-on list. The content read now passes the reader, so it can apply the rule.
- The publish and update replies. The author is the reader, so they see the count.
- The like reply and the guest-like reply, including the guest-like path that answers when the feature is off, and the path for an account that already likes the listing.
- A user's listings, both "my listings" and another user's listings. These go through the catalog query, so ticket 01 already applies the rule to them.
- Profile totals. Hidden likes leave the public like total. The author and staff see the full total. The total's SQL uses the same SQL form of the rule that ticket 01 added, so the rule is not copied.
- Staff-only routes (likers, audit, like removal) are not changed, because staff pass the rule.

### Caching

- The single listing read gets the same per-reader caching as the catalog: private, no-cache, and varying on the authorization and install headers. Otherwise one reader's count could be served to another.
- The listing content and dependency content reads carry per-reader counts too, so they send the same headers. One shared server helper sets them on every per-reader read.
- The catalog and dependency reads already vary per reader. The client catalog cache is keyed by reader. When results are announced, the response body changes, so the tag changes and the client takes the new rows.

### Client display

- One pure helper reads a listing record and returns what to show: a number, a private number, or hidden. Every per-listing count uses it: the community card, the listing details modal, and profile creation rows.
- The profile total stays a plain number for every reader, with no tooltip. The server already sends each reader the right total. (Q12, 2026-09-30)
- A hidden count shows as a heart with "—". The heart stays pressable. Its tooltip reads "You'll see likes after staff announce the winners".
- A private count shows the number. Its tooltip reads "Only the author and staff see this count until staff announce the winners". The wording names the author, so it stays true for a staff reader.
- After a like press, the client keeps the hidden state from the reply. It never shows an optimistic number on a hidden entry.
- Tooltip copy goes through the copy sweep.

### Client ordering

- The contest tab shuffles entries in both the live and the judging phases. It orders by likes only after results are announced, with the podium first. This replaces the contest-events ruling that the judging phase orders by likes.
- Sorting the catalog by likes treats a hidden count as 0.
- The Podium dialog is staff-only and gets real counts, so it keeps its standings and tie markers.

### Old clients

- No version gate is added. Old clients show "0" on hidden entries, and a like press on one settles at 0.
- The website sends no version header, so a version gate would also block the website. That is a further reason not to gate.

### Shape

- No world or save export shape changes. The API gains two additive flags.

## Testing Decisions

- Tests check what a reader receives and sees, never how the rule is built.
- **Server seam: HTTP route tests.** One table of reader (guest, other account, author, staff) × contest state (live, judging, results announced, withdrawn, canceled) runs against every route that emits a count. Each case asserts whether `likes` is present, which flag is set, and that the like replies follow the same contract.
- A sort test proves that `sort=likes` gives a public reader no rank. The test gives one hidden entry many likes and checks that it sorts with the zero-like listings.
- A profile test proves that the public total leaves out hidden likes and the author's total does not.
- A caching test proves that the single listing read varies by reader.
- Each guard must bite. Reinstate the leak (for example, drop the reader from the content read) and confirm the test fails.
- Server prior art: the likes, anonymous likes, contest entries, author listings, user profile, and catalog freshness route tests.
- **Client seam:** the pure display helper, the contest-order functions, and one LikeButton render test for the dash and both tooltips. The contest-order tests already exist and gain the judging-phase shuffle case.
- Client prior art: the contests library tests and the LikeButton and community card tests.

## Out of Scope

- A per-contest toggle for hiding likes.
- Keeping a withdrawn entry's or a canceled contest's counts hidden.
- A version gate that forces old clients to update.
- Hiding download counts or comment counts.
- Hiding who liked what from staff.
- Any contest scoring from likes. Staff still pick the podium by hand.
- A new icon or badge for private counts. The tooltip carries the meaning.

## Further Notes

- The server part must deploy before the client part. The client reads the flags when present and falls back to today's behavior when absent.
- If a contest is live when the server deploys, its counts hide at once. That is intended.
- The dash for a hidden count is a new visual state of the like button. It needs the user's approval in the design-system showcase before it ships.
- The contest-events spec still says the judging phase orders by likes. This spec supersedes that ruling.
