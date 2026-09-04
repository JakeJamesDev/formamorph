# Content Reports

Status: ready-for-agent

Users report community content to staff; staff action the report with existing moderation tools; the reporter gets an automatic outcome message. Designed in a grilling session on 2026-08-24; flow validated in [prototype.html](prototype.html) (the `ReportModel` module inside it is the liftable rules encoding).

## Problem Statement

Community Creations has no way for a user to tell staff about content that breaks the rules. A player who finds a stolen world, a phishing link in a comment, or an offensive profile image can hide it locally — but staff never hear about it, and the content stays up for everyone else. Staff moderation tools exist (quarantine, takedown, message, suspend) but only fire when staff happen to see the problem themselves. And a user who does manage to reach staff through some side channel never learns whether anything was done.

## Solution

A Report is a signed-in user's one-shot ticket flagging a Report Target — a listing of any kind, a comment, or a user profile — with a category and optional details. Reports land in a staff-visible queue (a new tab in the existing staff panel), grouped by target with counts. Staff view the target, act with the moderation tools that already exist, and resolve the group once with an Outcome — action taken or dismissed — plus an optional note. Every reporter in the group automatically receives an inbox message with the Outcome. The specific moderation action is never named to reporters.

## User Stories

### Reporting

1. As a signed-in user, I want a Report option on a listing's details modal, so that I can flag a listing that breaks the rules without leaving the browser.
2. As a signed-in user, I want a Report option on each comment, so that I can flag an abusive or malicious comment specifically rather than the whole listing.
3. As a signed-in user, I want a Report option on a user's profile, so that I can flag an offensive profile image or username.
4. As a reporter, I want to pick a category — Illegal content, Hate or harassment, Spam or scam, Stolen content, Malicious content or links, or Other — so that staff can triage by severity.
5. As a reporter, I want an optional free-text details field, so that I can explain what's wrong when the category alone doesn't say it.
6. As a reporter, I want confirmation that my report was filed, so that I know it reached the queue.
7. As a reporter, I want a clear "already reported — pending review" response if I try to report the same target twice while my report is open, so that I know staff have it and I'm not being ignored.
8. As a reporter, I want to be able to report a target again after my previous report on it was resolved, so that a new violation after an update isn't locked out.
9. As a signed-out visitor, I want to see no report controls at all, so that the UI doesn't offer me an action I can't take.
10. As a reporter, I want my identity hidden from the content's author, so that reporting doesn't invite retaliation.

### Being notified

11. As a reporter, I want an automatic inbox message when my report is resolved, so that the loop is closed without me checking back.
12. As a reporter, I want that message to say whether action was taken or no violation was found, so that I know the outcome without learning moderation specifics.
13. As a reporter, I want to see an optional staff-written note in that message, so that staff can add context when it helps.
14. As a reporter, I want the resolution message to arrive through the existing inbox with its existing badge and toast, so that I notice it the same way I notice any other message.

### Working the queue (staff)

15. As a staff member (mod, dev, or admin), I want a Reports tab in the staff panel, so that triage lives where the other everyday staff work already does.
16. As a staff member, I want the queue grouped by reported target with a report count and every reporter's category visible, so that a pile-on reads as one item of work, not N.
17. As a staff member, I want an unread indicator for open reports riding the existing badge plus a count on the tab, so that new reports get seen without anyone remembering to check.
18. As a staff member, I want to open the reported target from the queue — the listing's details, the comment in context, or the user's profile — so that I can judge what was actually reported.
19. As a staff member, I want to act with the existing tools (quarantine, takedown, comment deletion, profile-image removal, message, suspension), so that reports add triage, not a second moderation system.
20. As a staff member, I want to resolve a target's group once — action taken or dismissed, with an optional note — and have every open report in it close and every reporter notified individually, so that a pile-on is one resolution, not N.
21. As a staff member, I want a report whose target was deleted by its own author to stay open, flagged, with a snapshot of what was reported, so that I can still act on the account and close the loop with the reporters.
22. As a staff member, I want to see reports on staff-authored content in the queue, so that complaints about staff are never invisible.
23. As a mod, I want to be refused when resolving a report on content by a fellow staff member I don't outrank, so that "staff moderate the room, not each other" holds here too.
24. As an admin, I want to resolve reports on staff-authored content, so that those complaints have a path to closure.
25. As a staff member, I want resolutions recorded in the audit log, so that moderation stays accountable.
26. As a staff member, I want to open a user's profile from the panel's Users tab, so that I can see what I'm moderating (QoL rider from this design session).

### Authors

27. As an author whose content was actioned, I want the existing quarantine/takedown/explain-why notices unchanged, so that being reported feels no different from any other moderation.
28. As an author, I want deleting my own content to neither punish nor absolve me automatically, so that self-removal doesn't game the system.

## Implementation Decisions

- **Own private `reports` storage on the server** — not an extension of the feedback tables. Feedback's visibility rules make suggestions public and its constraints encode bug-vs-suggestion semantics; reports are never public. The report row snapshots the target (kind, name, author, and the offending text for comments) at filing time, following the audit log's snapshot pattern, so tickets outlive their targets.
- **Target reference covers three types**: listing (any kind), comment, user profile. Changelog entries are reported via their listing.
- **Lifecycle**: open → resolved, with Outcome `actioned` or `dismissed`. No other states. One open Report per reporter per target, enforced server-side; re-filing is allowed once resolved. Author self-deletion of the target flags open reports ("content removed by author") and closes nothing.
- **Resolution is per-target, not per-report**: resolving fans out to every open report on that target, and sends each reporter a templated message through the existing admin-messages inbox (with optional staff note). No new notification infrastructure — badge, toast, and polling are already there. The message never names the specific action.
- **No new moderation verbs.** Staff act via the existing quarantine / takedown / comment-delete / avatar-removal / message / suspension tools and their existing author-facing notices; the report system only records the Outcome. Resolutions get audit log entries.
- **Access rules**: submitting requires authentication; the queue requires staff; resolution additionally requires `canModerate(actor, target author)` — the existing role rule, so staff-authored targets are visible to all staff but resolvable only by someone who outranks the author.
- **Queue UI** is a new tab in the existing staff panel (open to all staff already; only Broadcasts/Policies are admin-gated — no regating). Groups by target with counts and per-reporter categories; "view target" opens the listing details modal, the comment, or the user profile dialog. Open-report count joins the staff user's unread badge channels and shows on the tab.
- **Users tab rider**: rows in the staff panel's Users tab gain a way to open the user's profile dialog.
- **Client degradation**: the client detects server support by response shape (the established absence-detection pattern) and hides all report controls against a server without the feature — this server is a live third-party production deployment and the client may ship first.
- **Rate limiting** rides the server's existing request limiter; the one-open-per-target rule is the main flood control.
- Core rules as validated in the prototype (trimmed from `ReportModel` in [prototype.html](prototype.html)):

  ```js
  // Resolution gate — the existing role rule, applied to the target's author:
  canModerate(actor, targetAuthor)  // staff moderate the room, not each other

  // Duplicate guard (submit):
  reports.some(r => r.reporter === reporter && r.target === target && r.status === 'open')
    → reject "already reported — pending review"

  // Resolution (per target, never per report):
  openReportsOn(target).forEach(r => {
    r.status = 'resolved'; r.outcome = outcome;            // 'actioned' | 'dismissed'
    inbox(r.reporter).send(template(outcome, r.snapshot) + optionalNote);
  })

  // Author self-deletion:
  openReportsOn(target).forEach(r => r.targetGone = true)  // stays open, snapshot intact
  ```

## Testing Decisions

- Tests assert external behavior at the seams below — never internals. Good tests here prove the lifecycle rules (duplicate guard, fan-out, role gates, gone-target flag), not storage details.
- **Server HTTP routes (primary seam)**: the full lifecycle through the API against a scratch database, in the style of the existing feedback and changelog route tests — submit (auth required, validation, category set, duplicate guard, snapshot), queue read (staff-gated, grouped, staff-authored targets visible to mods), resolve (canModerate enforced, all open reports on the target close, one inbox message per reporter with correct template and note, audit entry), author-deletion flagging, unread count, absence of reports in any public payload.
- **Client pure module (one new seam)**: a lib module owning grouping, the category list, validation, and server-support absence detection, unit-tested directly — the pattern set by the listing-changelog lib module.
- **Client components (existing harness)**: the Reports tab through the staff-panel test harness like the existing tab tests; the report dialog's states (signed-out hidden, duplicate rejection message); the dev-router ledger drift-guard for any new route entries.
- Guards must bite: each rule's test should fail if the rule is removed (e.g. drop the duplicate guard, watch the test go red) — per the project's test bar.

## Out of Scope

- **Staff username rename** — no endpoint exists anywhere; offensive usernames are handled via message/suspension. Named as a known limitation.
- **Report-spam countermeasures** beyond the duplicate guard and rate limiter (no "banned from reporting" flag) — staff already have message/suspend.
- **Threaded reporter↔staff dialogue** — a Report is one-shot by design.
- **A "My Reports" status view** for reporters — the inbox message is the whole loop in v1.
- **New notification infrastructure** (websockets, email, push).
- **Declined categories**: missing content warnings, personal information/doxxing, impersonation — fold into Other for now.
- **Reporting individual changelog entries** — ride the listing report.

## Further Notes

- **Spans both repos.** The server is FieryLion's live production deployment (MIT collaboration) — server changes need coordinating with the owner before deploy, and the client must degrade gracefully in the meantime (see Implementation Decisions).
- No world/save export shape is touched.
- Glossary terms **Report**, **Report Target**, **Outcome** are in the repo's CONTEXT.md.
- The prototype stays in this directory as a primary source; when implementation lands, capture it to a throwaway branch per the prototype skill's convention.
