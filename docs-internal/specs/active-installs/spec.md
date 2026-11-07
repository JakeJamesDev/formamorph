# Spec: Active Installs

Status: ready-for-agent

Both repos: the client sends, the server counts. Tickets carry a `Repo:` line for the server half.

## Problem Statement

Staff cannot see how many people use the app. The game runs on the device, and most use never reaches the server. Login signals count only accounts that sign in again, Formamorph AI rows count only paying players, the request log has no identity, and GitHub counts downloads, not use. So there is no way to see whether an update, a new world or a burst of interest grows the player base, or how fast a release spreads.

## Solution

Each copy of the app tells the server once per UTC day that it was opened. The server keeps only daily and monthly distinct totals, broken down by platform and app version. An admin reads them as daily active installs (DAU) and calendar-month active installs (MAU).

- **Active** means the app was opened that UTC day.
- The send is **on by default**. A switch in Settings turns it off.
- It identifies the copy of the app by its **Install** id, the one guest likes already use. Every copy of the app now has one.
- The server stores only a **keyed hash** of the Install id. The key changes each calendar month and is deleted when the month closes. After that, only totals remain.
- The send never carries or stores an account.
- The privacy policy names the daily send, what it holds, how long, and the off switch.

## User Stories

1. As an admin, I want the number of installs that opened the app each UTC day, so that I can see daily use.
2. As an admin, I want the number of installs that opened the app each calendar month, so that I can see the size of the player base.
3. As an admin, I want each day's total split by platform, so that I can see where people play.
4. As an admin, I want each day's total split by app version, so that I can see how fast a release spreads.
5. As an admin, I want each month's total split by platform and version, so that I can compare months.
6. As an admin, I want an install that updates during a day to count once that day, under the first version it sent, so that an update never counts one install twice.
7. As an admin, I want an install that updates during a month to count once in that month's total, under the first version it sent that month, so that MAU stays distinct.
8. As an admin, I want the current month's totals so far, so that I do not wait for the month to close.
9. As an admin, I want closed months kept as totals with no end date, so that I can see trends over years.
10. As an admin, I want a request without a valid Install id to count nothing, so that junk never inflates the totals.
11. As an admin, I want repeated sends from one install on one day to count once, so that a looping client cannot inflate DAU.
12. As an admin, I want the public send rate-limited per address, so that a script cannot fill the database.
13. As an admin, I want the totals behind the admin gate, so that the numbers are not public.
14. As a player, I want the app to send at most once per UTC day, so that it costs nothing I can notice.
15. As a player, I want the send to hold no play, no world and no account, so that my play stays on my device.
16. As a player, I want a Settings switch that stops the send, so that I can opt out.
17. As a player, I want the switch on by default and clearly named, so that I know it is there.
18. As a player, I want the switch to take effect at once, so that nothing is sent after I turn it off.
19. As a player, I want a failed send to stay silent, so that being offline never shows an error.
20. As a player who was offline, I want the app to count me when it next reaches the server, for that day only, so that no log of my past days is kept on my device.
21. As a player, I want the server to keep only a hash of my Install id that it cannot reverse after the month, so that old records cannot be traced back to my copy of the app.
22. As a player, I want the privacy policy to name the daily send, so that nothing is collected that the policy does not name.
23. As a player, I want the policy to say that signing in links my copy of the app to my account, so that the effect on guest likes is not a surprise.
24. As a Steam player, I want no send at all, since my build has no community server.
25. As an admin, I want the month close to run even if the server was down at midnight, so that a late close still produces the totals.

## Implementation Decisions

**Client**

- One sender module owns the daily send. It runs on app start and when the app regains focus or becomes visible.
- It sends only when the build has a community server, the Settings switch is on, and the last day it sent successfully is not the current UTC day.
- The request carries the Install id header and the client header. The existing fetch wrapper already adds the client header to every community-server request. It carries no credential, no body and no account.
- The sender gets the Install id with the existing "made on first need" accessor, so every copy of the app now has one.
- The day is marked sent only after a 2xx reply. A failed send is dropped silently, and the next focus that day tries again. No list of past days is kept.
- A new boolean setting, on by default, controls the send. Existing installs get it on after the update. Turning it off stops the next send at once. The label follows the project's writing guide.

**Server**

- A public route accepts the daily send. It is rate-limited per address with the same in-memory limiter the funnel route uses. It requires a valid Install id header and refuses anything else without storing it.
- The platform and version come from the parsed client header. Version zero stores null, as the telemetry spec rules.
- A table of month keys holds one random secret per calendar month (UTC), made on the first send of the month. A month key is never returned by any route.
- A table of daily rows holds the UTC day, the hash, the platform and the version. The hash is HMAC-SHA256 of the Install id under the month key. A unique index on day and hash makes a repeated send a no-op, so the first version that day is kept.
- A totals table holds closed periods: period kind (`day` or `month`), period, platform, version and count.
- **Month close** runs from the existing hourly retention sweep with an explicit `now`. For every month before the current one that still has rows, it writes each day's totals and the month's total, then deletes that month's rows and its key, in one transaction. The month total counts each hash once, under the platform and version of its first row that month.
- An admin route returns `days` and `months`, each with a total and a breakdown by platform and version. Closed periods come from the totals table. The current month and its days are counted live from the daily rows. It takes a range in days for `days`, and returns every month.
- No row in any of these tables holds an account id, an address or a raw Install id.

**Privacy policy**

- A new section describes the daily send: it says the app was opened that day, it holds a hash of the Install id, the platform and the app version, the daily records are deleted when the month closes, totals are kept with no end date, and the Settings switch turns it off.
- The guest-likes section changes from describing the Install as something made for a guest like to describing it as made once by every copy of the app. Its sign-in sentence says that signing in links the Install to the account, whether or not it gave a guest like.
- The retention list gains the daily records (until the month closes) and the totals (kept).
- This edit and the telemetry spec's policy edit publish together, as one re-accept.

## Testing Decisions

- **Two seams, one per repo.** Both are existing entry points, and each test asserts what a caller sees.
- **Server: HTTP.** Tests send the daily request over HTTP and read the admin route. The month close is tested through the retention sweep with an explicit `now`, with fake system time around the sends. Prior art: the funnel totals tests and the anonymous-like tests for the Install header.
  - A valid send counts once. A repeated send that day still counts once.
  - A send with a missing or malformed Install id is refused and counts nothing.
  - An install that sends two versions in one day counts under the first.
  - Two days, one install: DAU is 1 each day and MAU is 1.
  - Month close writes the day and month totals, deletes the month's rows and key, and the admin route returns the same numbers before and after the close.
  - A close that runs days late produces the same totals.
  - The admin route refuses non-admins. No response contains a hash, a key or an Install id.
- **Client: the sender module, with fetch faked.** Prior art: the funnel sender and the anonymous-like Install tests.
  - It sends once per UTC day, and again after the day changes.
  - A failed send is retried on the next focus that day, and succeeds silently.
  - With the switch off, nothing is sent.
  - A build without a community server sends nothing.
  - The request has the Install id and client headers, and no credential or body.
- Per the test bar: prove each guard fails when its bug returns. For example, drop the unique index and the repeated-send test must go red.

## Out of Scope

- **Steam builds.** They have no community server. Steam's own statistics cover them.
- **Weekly active installs.** Ruled out: a week that spans two months would need both keys.
- **A rolling 30-day MAU.** Ruled out by the monthly key.
- **Catching up days spent offline.** Ruled out: no local log of past days.
- **Splitting signed-in and guest installs.** The send never holds an account.
- **A dashboard.** The admin route's JSON is the only consumer.

## Further Notes

- **Every sign-in now links its Install to the account.** Today only an install that gave a guest like has an id, so only those are linked. With this change every copy of the app has one, so every sign-in links it. Afterwards, guest likes from that copy of the app follow the account's rules, also on a shared computer after sign-out. The user accepted this over a separate activity id.
- **The current month can be joined while it is open.** The month key exists until the month closes. Anyone with database access and an Install id could compute its hash during that month. After the close, the rows and the key are gone.
- **Deploy and publish together.** The telemetry spec's server deploy and its policy publish wait for this feature, so players see one deploy and one re-accept. A client release must ship before any send arrives, so the server half can deploy first.
