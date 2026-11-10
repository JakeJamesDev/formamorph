# Spec: SES Mail

Status: ready-for-agent
Spec session: ses-mail — spec

Both repos: the server sends and tracks, the client shows. Tickets carry a `Repo:` line for the server half.

## Problem Statement

The server sends verification, password-reset and staff alert mail through a mail provider whose free plan allows 100 mails a day. Sign-ups now reach 80 a day. When the cap is hit, new accounts get no verification mail and password resets fail without a sign.

The server also cannot tell what happens to a mail after the provider accepts it. A user who typed a wrong address waits for a mail that never comes. Staff cannot answer "did my mail arrive?". Nobody sees a rising bounce rate until the provider acts on it.

## Solution

The server sends all mail through Amazon SES, which is approved for 50,000 mails a day in US East (Ohio) and costs about a dollar a month at current volume. The old provider is removed.

SES reports what happens to each mail, and the server records it:

- **The user** sees on the account page that mail to the address bounced, and what to do.
- **Staff** open one account's mail history from the Admin Panel and can clear a bounce.
- **Admins** see daily mail numbers in a new Mail tab and get an alert before Amazon reviews the account.
- **The server** stops sending to an address that bounced or complained.

## Rulings

| # | Ruling |
|---|---|
| Q1 | One effort: transport swap, tracking, and the privacy-policy change. |
| Q2 | Tracking serves four uses: tell the user, staff lookup, health numbers, stop bad sends. |
| Q3 | The old provider is removed completely. No fallback. |
| Q4 | Bounce state is a marker on the user row, cleared when the address changes. Mail-log rows hold user id, message id, kind and status. Never an address. |
| Q5 | SES events reach a webhook on the API through EventBridge. |
| Q6 | The server records delivery, delay, bounce and complaint. Never opens or clicks. |
| Q7 | Mail-log rows are deleted after 90 days. |
| Q8 | A bounced address recovers only when the user changes it or staff clear it. |
| Q9 | A spam complaint counts the same as a hard bounce. |
| Q10 | Admins get an alert on any non-healthy SES account status, and when the 7-day rate reaches 2.5% hard bounces or 0.05% complaints. |
| Q11 | A new admin-only Mail tab in the Admin Panel shows the numbers. |
| Q12 | Staff open one account's history from a Mail History item in the user row's menu, in a dialog. |
| Q13 | All staff see history and clear bounces. Each clear is written to the audit log. |
| Q14 | A hard bounce removes verification from the address. |
| Q15 | The transport lands and deploys first, alone. |
| Q16 | After staff clear a bounce, the user verifies the address again. |
| Q17 | The bounce notice points to the website feedback form. |
| Q18 | The password-reset page stays silent about bounces. |
| Q19 | A rate alert needs at least 200 mails in the 7-day window. |
| Q20 | The privacy policy is published once, at the ticket 01 deploy, with both the processor change and the delivery-records wording. |

## User Stories

**Sending**

1. As a new user, I want my verification mail on a busy day, so that a daily cap never leaves my account unverified.
2. As a user who forgot a password, I want my reset mail on a busy day, so that I can get back in.
3. As an admin, I want one mail provider in the code and the privacy policy, so that there is one thing to keep working.
4. As an admin, I want a server with no SES key to refuse mail the way it refuses today, so that a development box never sends real mail.
5. As a user, I want my mail free of tracking pixels and rewritten links, so that a verification link is the link the server wrote.
6. As a reader of the privacy policy, I want it to name Amazon SES as the mail processor, so that the policy matches what happens.

**The user with a bad address**

7. As a user whose verification mail bounced, I want the account page to say so, so that I stop waiting for it.
8. As a user whose mail bounced, I want the notice to tell me to use a different address, so that I know the fix.
9. As a user whose address is correct, I want the notice to point to the website feedback form, so that I can ask staff to clear it.
10. As a user who changes the address, I want the bounce notice gone at once, so that an old failure never marks the new address.
11. As a user with a bounced address, I want Resend Verification Email to explain why nothing is sent, so that I do not press it again and again.
12. As a user whose verified address later bounced, I want it shown as not verified, so that I learn password reset will not reach me.
13. As a user who marked a mail as spam by mistake, I want the same notice and the same way back, so that I am not silently cut off.
14. As a user, I want the same notice in the game's account settings and on the website account page, so that either place tells me.
15. As a user whose bounce was cleared by staff, I want to verify again with one button, so that I prove the inbox works.
16. As a user whose mail is only delayed, I want no bounce notice, so that a slow inbox is not treated as a dead one.

**Password reset**

17. As a visitor on the reset page, I want one fixed answer whatever name I type, so that the page never reveals which accounts exist or whose mail fails.
18. As a user with a bounced address, I want no reset mail attempted, so that the server does not send into a dead inbox.

**Staff**

19. As a staff member, I want to open one account's mail history, so that I can answer "did my mail arrive?".
20. As a staff member, I want each row to show the kind of mail, when it was sent and what happened to it, so that I can read the story in order.
21. As a staff member, I want delayed mail shown as delayed, so that I can tell a user to wait.
22. As a staff member, I want to see that an account's address is bounced or complained, and since when, so that I know why mail stopped.
23. As a staff member, I want a Clear Bounce action in the history dialog, so that I can fix a false bounce.
24. As a staff member, I want Clear Bounce to also take the address off the SES suppression list, so that the next mail is really sent.
25. As a staff member, I want the dialog to say when the clear did not reach SES, so that I do not tell the user it is fixed.
26. As a moderator, I want history without the email address in it, so that I can help without seeing private data.
27. As an admin, I want each clear in the audit log with who did it, so that the action is accountable.

**Admins and health**

28. As an admin, I want a Mail tab with sent, delivered, delayed, bounced and complaint counts per day, so that I can see mail health.
29. As an admin, I want the 7-day bounce and complaint rates next to Amazon's limits, so that I can see how close we are.
30. As an admin, I want the SES account status and today's quota use on the tab, so that I see a review or a pause.
31. As an admin, I want an urgent message when SES reports a non-healthy status, so that I learn of a review the hour it starts.
32. As an admin, I want an urgent message when the 7-day rate reaches 2.5% bounces or 0.05% complaints, so that I can act before Amazon does.
33. As an admin, I want each alert once until the condition clears, so that the inbox is not flooded.
34. As an admin, I want the in-app message even when mail is paused, so that a paused SES cannot hide its own alert.
35. As an admin, I want staff alert mail counted in the numbers, so that the totals match what SES sent.
36. As an admin, I want the Mail tab hidden from moderators, so that it is gated like Usage.

**Privacy and safety**

37. As a user, I want mail records to hold no email address, so that my address lives in one place.
38. As a user, I want mail records deleted after 90 days, so that old activity is not kept.
39. As a user who deletes the account, I want my mail records gone with it, so that nothing of me remains.
40. As a reader of the privacy policy, I want it to say that delivery results are recorded and for how long, so that I know what is kept.
41. As an admin, I want the webhook to refuse a request without the shared secret, so that nobody can forge a bounce and lock an account out of mail.
42. As an admin, I want an event the server already recorded to change nothing when it arrives again, so that EventBridge retries are harmless.
43. As an admin, I want an event for an unknown mail accepted and ignored, so that EventBridge does not retry it for a day.
44. As an admin, I want a bounce for an old address ignored after the user changed it, so that a late event never marks the new address.

## Implementation Decisions

**Order (Q15)**

- The transport ships first and alone: transport, environment keys, tests, the privacy-policy processor line, and removal of the old provider's code.
- Until tracking lands, a mail to a suppressed address reports as sent. This window is accepted.

**Transport**

- One SES transport sits behind the existing `sendMail` seam. Callers do not change.
- It uses the SES v2 API through the official AWS SDK. SES requests need AWS request signing, so a bare `fetch` cannot do it.
- All AWS calls go through one SES client object: send, read account status, remove from the suppression list. Tests replace this object.
- The choice of transport stays decided once at start-up from the environment. No key means the refusing transport, as today.
- New environment keys: AWS access key id, secret, region, and the name of the SES configuration set. The old provider's key is removed. The keys are documented where the server's other keys are.
- Each mail is sent with the configuration set, a mail-id tag and a kind tag. Tags allow only letters, digits, underscore and dash.
- `sendMail` gains the user id and the kind (`verify`, `reset`, `alert`) and returns nothing new to callers that do not need it.

**Mail log**

- New table, one row per mail: own id, user id (empty for staff alerts), kind, SES message id, status, the time sent and the time of the last status.
- Status moves `sent` → `delayed` → `delivered`, or to `bounced` or `complained`. A later event never moves a final status back.
- The row is written when SES accepts the mail. The row's own id is the tag, so an event finds its row without the address.
- Rows are deleted after 90 days by the existing retention sweep, and with the account on deletion.

**Bounce marker (Q4, Q8, Q9, Q14)**

- Two new columns on the user: the time the current address was marked, and the reason (`bounce` or `complaint`).
- A hard bounce or a complaint sets the marker and removes verification.
- The marker is set only when the event's mail was sent after the address was last changed. The user row records when the address was set, so a late event for an old address is ignored.
- Changing the address clears the marker.
- While the marker is set, the server sends no verification and no reset mail to that address.
- A soft bounce (delay, full mailbox) never sets the marker.

**Webhook (Q5, Q6)**

- One public route receives SES events from an EventBridge API destination.
- EventBridge sends a shared secret in a header. The server compares it in constant time and refuses a mismatch. The secret is an environment key.
- The route handles delivery, delivery delay, bounce and complaint. Any other event type gets a success answer and is ignored.
- An event with an unknown tag gets a success answer and is ignored.
- The handler never stores or logs the recipient address from the event.
- The route takes the raw body with its own size limit, like the existing third-party webhook.

**API changes**

- The account summary gains the marker: its reason, or nothing. Every response that returns the summary carries it.
- Resend-verification and set-email answer with a distinct code when the address is marked, and send nothing.
- The reset request keeps its one fixed answer (Q18).
- New staff routes: read one account's mail history and marker; clear the marker.
- New admin route: the mail report (per-day counts, 7-day rates, SES status, quota use).

**Clearing a bounce (Q8, Q13, Q16)**

- Clearing removes the marker and asks SES to remove the address from the account suppression list.
- The server reads the address from the user row for that call and keeps no copy.
- Verification is not restored. The user sends a new verification mail.
- If the SES call fails, the marker stays and the staff member sees the failure.
- Each clear writes an audit-log entry with the staff member and the account.

**Health (Q10)**

- An hourly job asks SES for the account status and quota, because Amazon sends no event when it pauses an account.
- The same job computes the 7-day hard-bounce and complaint rates from the mail log.
- It alerts admins through the existing staff alert path: an urgent in-app message, and staff alert mail when configured.
- Three alert conditions: status not healthy, bounce rate at 2.5% or more, complaint rate at 0.05% or more. Each alerts once and re-arms when the condition clears, like the provider-balance alert.
- A rate alert needs at least 200 mails in the window (Q19), so one bounce among ten mails does not alert.

**Client**

- The email section in the game's account settings and on the website account page shows the marker state and the notice, with a link to the feedback form (Q17).
- The Resend Verification Email button is replaced by the notice while the marker is set.
- The user row's menu in the Admin Panel gains Mail History, for all staff (Q12, Q13). It opens a dialog with the rows, the marker, and Clear Bounce.
- The Admin Panel gains an admin-only Mail tab (Q11), built from the Usage tab's tiles and tables.
- All new copy follows the writing guide and is written from a facts list in the user's words.
- New screens and dialogs get dev-router entries.

**Privacy policy**

- The processor section names Amazon SES in place of the old provider.
- It says the server records whether each account mail was delivered, delayed, bounced or reported as spam, keeps that for 90 days, and stores no address with it.
- Both changes land in ticket 01 and are published once at its deploy (Q20), because a publish makes every user accept the policy again. The policy describes delivery records a few days before the server keeps them.

**Ticket 01 rulings**

- Ticket 01 sends with the configuration set only. Tags and the new `sendMail` arguments belong to ticket 02.
- AWS keys set but no configuration set name: mail is off, and the start-up log names the missing key.
- Region unset: the server uses `us-east-2`.

**Not affected**

- World and save files do not change.

## Testing Decisions

A good test here drives a route or the transport seam and checks what a caller or a user sees: the response, the stored state read back through another route, the mail captured. It does not check which internal function ran.

- **Seams.** Server tests go through the HTTP routes. The one new replaceable piece is the SES client object. No test calls AWS.
- **Transport.** With a fake SES client: the request carries the sender, reply-to, configuration set and tags; an SES refusal becomes a failed send; no key means refusal. Prior art: the existing transport unit tests.
- **Callers.** The account-mail and password-reset suites keep using the capture transport. They must pass unchanged apart from the new arguments.
- **Webhook.** Post captured EventBridge payloads for each event type with the secret header. Check: wrong secret refused; each event moves the status; a repeated event changes nothing; an unknown tag is accepted and ignored; a bounce sets the marker and removes verification; a bounce older than the address change is ignored; the address from the payload is stored nowhere. Prior art: the third-party webhook tests.
- **Stop bad sends.** With the marker set: resend-verification answers with the code and the capture transport holds no mail; the reset request gives the fixed answer and sends nothing; changing the address clears the marker and sends again.
- **Clear.** Staff clear removes the marker, calls the fake SES client with the user's address, writes the audit entry, and leaves the address unverified. A failing SES call keeps the marker. A non-staff caller is refused.
- **Report and alerts.** Seed log rows and check the counts and rates. Drive the hourly job with a fake status: one alert per condition, none on the next run, one again after it clears and returns. Below the minimum volume, no rate alert. Prior art: the hosted alert and limits tests.
- **Retention and deletion.** Rows older than 90 days go in the sweep; an account deletion removes its rows. Prior art: the retention sweep tests.
- **Schema.** The new step joins the boot-schema and smoke lists, as every table step does.
- **Client.** Component tests with mocked services: the notice shows for each reason and hides after an address change; the resend button gives way to the notice; the Mail History item shows for staff and the Mail tab for admins only; Clear Bounce reports success and failure. Prior art: the account settings and admin tab tests.
- Every guard is proven by putting the bug back and seeing the test fail.

## Out of Scope

- Marketing mail, mailing lists and unsubscribe handling.
- Open and click tracking.
- A self-service retry for a bounced address.
- A bounce notice on the password-reset page.
- Importing history from the old provider.
- Dedicated IPs, Virtual Deliverability Manager and SES address validation.
- A second sending region.
- Rewording the mails themselves.

## Further Notes

**Steps only the user can do**

1. Create an IAM user that may only send from the mail domain, read the account status, and remove suppression entries. Create its access key.
2. Create an SES configuration set with an EventBridge event destination for delivery, delivery delay, bounce and complaint.
3. Create the EventBridge connection, API destination and rule that forward SES events to the webhook with the shared secret.
4. Put the keys in the server environment and deploy.
5. After mail is proven live on SES, remove the old provider's DNS key record and close that account.

**Facts the tickets rely on**

- SES accepts a mail to a suppressed address, returns a message id, and does not send it. The marker exists so the server does not depend on this.
- Amazon reviews an account at 5% hard bounces or 0.1% complaints and may pause it at 10% or 0.5%.
- Amazon computes its own rates over a volume it does not publish. Our 7-day rate is an early warning, not the same number.
- SES events always contain the recipient address. The server reads the tag and drops the rest.
- The sender domain's DMARC policy is `reject`, so SES must sign with a key on that domain. The domain is already verified in SES.

**Not verified yet**

- Whether SES publishes a bounce event for a mail to a suppressed address.
- Whether the EventBridge connection lets us name the secret header. The first webhook ticket checks both against a live event before the handler is final.
