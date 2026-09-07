# Spec: Community Creations on the website

Status: ready-for-agent

## Problem Statement

Visitors must open the game to discover and download community creations. This adds friction to sharing a creation, exploring a creator's work, and leaving a Like. The website needs a discovery surface that works for guests while keeping community content behind the existing content warning.

## Solution

Add a dedicated `/community` page, linked from the landing page navigation and the account/profile header. Keep the website header visible. Reuse the app's Community Creations browser for worlds, entities (the UI's Characters category), dictionaries, and contests.

Visitors accept the content warning before community content mounts or loads. They can browse, read full listing details, and download importable files without signing in. Signed-in visitors can add and remove Likes. Other interactions remain in the app, reached through one “Open in app” action that opens the browser game at the same creation.

Each creation has a shareable website URL. Creation cards on public website profiles link to that URL.

## User Stories

1. As a visitor, I want Community Creations in the landing page navigation, so that I can discover creations without launching the game.
2. As a visitor on an account or profile page, I want the same community link, so that discovery remains easy to reach.
3. As a visitor, I want the website header to remain visible while browsing, so that I can navigate the website normally.
4. As a guest, I want to browse without an account, so that I can explore before deciding to sign up.
5. As a visitor, I want the content warning before community text or images appear, so that I can make an informed choice.
6. As a visitor, I want community requests held until acceptance, so that declining actually avoids loading that content.
7. As a returning visitor, I want a current acceptance honored under the existing website gate rules, so that I am not prompted unnecessarily.
8. As a signed-in visitor, I want my account's acceptance checked and recorded, so that the website and app use the same policy.
9. As a visitor who declines, I want to return to the landing page, so that I leave community content behind.
10. As a guest whose browser refuses local storage, I want my acceptance to work for this visit, so that the catalog does not remain empty after I accept.
11. As a visitor, I want worlds, Characters, dictionaries, and contests available, so that I can discover every existing category.
12. As a visitor, I want the shared browser's search, filters, sorting, and pagination, so that finding creations feels consistent with the app.
13. As a visitor, I want full creation details and images, so that I can decide whether to download a creation.
14. As a visitor, I want to view existing activity, so that I can see the community's response before opening the app.
15. As a guest, I want to download a creation to my device, so that I can import it into desktop Formamorph or the browser game.
16. As a visitor downloading a world, I want its existing JSON export format, so that the app can import it.
17. As a visitor downloading an entity, I want the existing WebP card format, so that it works like an app-exported card.
18. As a visitor downloading a dictionary, I want its existing JSON export format, so that I can import it normally.
19. As a visitor, I want downloads without optimization prompts, so that downloading remains a direct action.
20. As a visitor, I want published world image links retained and the entity card portrait embedded as its format requires, so that export behavior is predictable.
21. As a visitor whose download fails, I want an understandable failure and a way to retry, so that I do not mistake an incomplete download for success.
22. As a signed-in visitor, I want to add a Like on the website, so that appreciating a creation takes little effort.
23. As a signed-in visitor, I want to remove my Like, so that it remains a revocable mark.
24. As a guest clicking Like, I want to sign in and return to the same creation, so that I do not lose my place.
25. As a guest returning from sign-in, I want to click Like myself, so that authentication does not silently cast a Like.
26. As a visitor, I want one “Open in app” action, so that I can comment or participate in a contest in the browser game.
27. As a visitor opening the app, I want the same creation selected, so that I do not need to search for it again.
28. As a visitor, I want a shareable URL for a creation, so that I can send someone directly to its details.
29. As a recipient of a creation link, I want the content warning to preserve my destination, so that acceptance opens the intended creation.
30. As a recipient of an unavailable creation link, I want a clear unavailable state, so that a missing listing does not leave the page stuck.
31. As a visitor viewing a public profile, I want its creation cards to open website listing details, so that I can explore and Like that creator's work.
32. As a mobile visitor, I want usable navigation, filters, details, and downloads, so that the community page works on my device.
33. As a visitor opening a lightweight account page, I want it to remain lightweight, so that adding community browsing does not load the game there.

## Implementation Decisions

- Reuse CommunityBrowserHost and CommunityCreationsBrowser. Extend their presentation and action boundaries; do not copy the browser, catalog logic, cards, filters, or details implementation into the website.
- Add the website route and hosting rewrite together. Direct visits, refreshes, and canonical trailing-slash handling must reach the same page.
- Provide a website presentation that fits below the visible header. The existing page presentation is a full-viewport layer and cannot simply be mounted inside the website layout unchanged.
- Load the community surface separately from lightweight account routes. Expand stylesheet coverage and bundle checks deliberately for the reused community modules while preserving isolation for account pages.
- Place the website content-warning gate outside the community host. Acceptance must precede catalog, events, contests, listing details, and thumbnail loading, including direct creation links.
- Reuse the existing guest and account acceptance rules, version checks, retry behavior, and authentication handoff. Ensure current-visit acceptance also authorizes catalog loading when persistence fails; do not bypass the warning to address that edge case.
- Reuse shared authentication and Like service behavior. Website capabilities permit browsing, details, device downloads, and Likes. Comment mutation, contest participation, publishing, author management, and moderation controls remain app actions even when the current account has elevated privileges.
- Guest Like activation uses the website sign-in return flow to preserve the selected creation. Returning does not issue a Like request. Like controls follow session changes and display server failures without falsely retaining success.
- Reuse the shared remote-content fetch and existing export serializers. Website Download saves a device file rather than writing the app's local library or showing local-library update/re-download states.
- Use world JSON, entity WebP cards, and dictionary JSON. Skip image optimization prompts and preserve published content through the existing serializers. Retain world image links; embed the entity portrait required by the card format. Report portrait-fetch or serialization failures rather than producing a misleading success.
- Keep Listing Changelog and other listing-only metadata outside downloaded content, consistent with existing exports. No new world/save export schema or version bump is authorized.
- Shareable creation URLs identify a listing and its kind and feed the existing listing-opening behavior after acceptance. Opening a card updates the shareable destination; opening that URL directly restores its details. Exact URL encoding is an implementation choice.
- Link public website profile creation cards to these destinations. Preserve established access restrictions for unavailable, hidden, quarantined, or removed listings; a URL is not an access grant.
- “Open in app” targets the browser game at `/play/`, carrying the selected creation into the existing app listing-opening flow and honoring the app's content gate. Add the URL ingestion needed for that handoff; do not treat an internal callback as already providing external deep links.
- Show existing activity with one app handoff, rather than individual unusable comment or participation controls. Retain the established visibility rules for Likes and Likers.

## Testing Decisions

- Primary seam: the rendered website route in the existing browser end-to-end harness, with controlled server responses and real shared UI, routing, authentication, and download behavior. Assert what visitors see, requests they cause, destinations reached, and files actually saved.
- Reuse the community-host render tests and website profile/content-warning tests for focused failure and session-transition cases. Avoid new low-level seams where a rendered route or existing service boundary can prove the behavior.
- Before acceptance, assert no community content or community requests, including catalog, events, contests, details, and thumbnails. Test ordinary entry and direct listing links; then accept and prove the requested content loads. Test decline, current acceptance, account read/write failures, and storage refusal without disabling the failing condition.
- Exercise all categories, representative filtering, details and image viewing, direct-link refresh, unavailable listings, and public-profile card navigation.
- Capture each real downloaded artifact and validate it through the existing import/parser boundary. Assert original authored content survives, world links remain links, entity portrait embedding works, and no optimization prompt or local-library write occurs. Cover failed content and portrait fetches.
- Exercise signed-in Like and unlike, request failure, session changes, guest sign-in return, and the absence of an automatic Like after authentication. Verify comments and contest mutation controls are absent from the website.
- Follow “Open in app” into the actual browser-game entry and assert the same creation opens after any required warning. Do not stop verification at checking the outgoing URL.
- Verify both website navigation links, direct hosting route behavior, desktop and mobile layouts, keyboard use, and both themes where shared colors or styles change. Use static DOM/frame evidence rather than animation timing.
- Retain account-page bundle isolation checks and verify website Tailwind coverage for all newly reachable UI. Test the app's existing modal presentation and library downloads against regressions from the shared boundary changes.
- During implementation, measure relevant coverage and prove new guards catch their target regression. Do not weaken fixtures to remove real failure triggers. Time test runs and investigate unexplained process tail time.
- Implementation completion requires typecheck, lint, tests, app build, website build, live UI verification, the In-Progress changelog entry, and a code-graph update. This document alone does not claim those implementation checks have run.

## Out of Scope

- Implementing this feature as part of writing the spec.
- A copied or independently maintained website community browser.
- Website comments, contest participation, publishing, author editing, reports, or staff moderation actions.
- Launching the installed desktop app or registering an OS protocol.
- Adding website downloads to the browser game's local library.
- New export formats, world/save schema changes, migrations, or a version bump.
- Requiring an account to browse or download, automatically liking after sign-in, or exposing content before warning acceptance.

## Further Notes

The product design was explicitly confirmed after grilling. Likes were intentionally added to the website scope to make appreciation easier across more surfaces.

The preliminary read-only investigation ran 39 existing tests covering the community host, website profile/content gate, and website bundle boundary; all passed in 5.22 seconds wall time. This establishes existing behavior, not verification of the proposed integration.

The spec is the implementation unit; no separate implementation tickets are created here.
