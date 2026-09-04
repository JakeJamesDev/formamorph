# Spec: Decouple the Community Creations browser from MainMenu

Status: ready-for-agent

## Problem Statement

The Community Creations browser can only exist inside MainMenu. MainMenu assembles fifteen props for it — the local world list and its setter, entity and dictionary metadata with refreshers, auth state, the image lightbox, active events, and listing plumbing — and owns its dialog shell. The planned site page (browse and download on formamorph.ai without launching the app) needs this exact component standalone, and the planned age gate needs one place to live that covers every surface. Neither can happen while the browser's data plane is MainMenu's private state.

## Solution

Give the browser a self-sufficient host: one component that owns everything the fifteen props carried, sourced from the same services and hooks MainMenu uses today. MainMenu becomes the host's thinnest consumer — it opens and closes it, points it at a tab or listing, and refreshes its own grids when it closes. The app looks and behaves exactly as before. A future site entry renders the same host as a full page instead of a dialog, and stays in sync by construction because there is only one data path.

## User Stories

1. As a player, I want Community Creations to look and behave exactly as it does today, so that this refactor costs me nothing.
2. As a player, I want a world download to appear in my library when I return to the main menu, so that the browser and library never disagree.
3. As a player, I want entity and dictionary downloads to land the same way, so that every kind behaves alike.
4. As a player, I want my signed-in state visible in the browser as before, so that likes, comments, and publishing keep working.
5. As a player, I want the contest tab, event banners, and notification-opened listings to keep working, so that no entry point regresses.
6. As a player, I want thumbnails to open in the image viewer as before, so that nothing visual changes.
7. As the maintainer, I want MainMenu to stop plumbing browser data, so that the god-component shrinks instead of growing.
8. As the maintainer, I want the host to own its data plane through the existing services, so that a second consumer cannot drift from the first.
9. As the maintainer, I want the host mountable without MainMenu, so that the site page and any future surface reuse it unchanged.
10. As the maintainer, I want the host to choose between dialog and full-page presentation, so that the in-app modal and the future site page are the same component.
11. As the maintainer, I want the dev-router to keep reaching the browser and its tabs, so that verification stays one goto.
12. As a future implementer of the age gate, I want one host through which every community surface renders, so that the gate is written once.

## Implementation Decisions

- **A new host component** owns what the props carried: library metadata for all three kinds (loaded from the world, entity, and dictionary storage services), auth state (from the auth service), active events (from the existing events hook), the image viewer, and the listing-opened plumbing. The existing browser component stays as the presentational core; the host wraps it.
- **The host's public interface is intent, not data:** open state, initial tab, a listing to open, and presentation mode. Roughly, from this spec's design discussion:

  ```ts
  interface CommunityBrowserHostProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    presentation?: 'dialog' | 'page';   // dialog = today's in-app modal
    initialTab?: BrowseTab;
    openListing?: { id: string; kind: string } | null;
    onListingOpened?: () => void;
  }
  ```

- **Library sync inverts.** The browser stops writing MainMenu's `worlds` state. The host owns its copy of the library metadata; MainMenu refreshes its grids when the host closes, the same pattern the World Editor modal already uses. Download state inside the browser stays live because the host refreshes its own copy after each download.
- **Auth stays service-backed.** The host reads the auth service directly and subscribes the same way MainMenu does. No new auth context; the site page later gets auth for free from the shared origin.
- **The image viewer moves into the host** (or a small shared component), so no surface has to supply one.
- **Presentation is a host concern.** `dialog` reproduces today's modal exactly — same animation, same close behavior. `page` renders the browser full-bleed with no overlay; nothing in this spec consumes it yet, but it must render correctly under the dev-router for verification.
- **MainMenu keeps only its intent props** — open state, tab, pending listing, and its close-refresh. Every data prop and callback it currently assembles for the browser is deleted from it.
- **The dev-router route keeps working unchanged** (`modal=community` plus `tab=`), now mounting the host; a mode flag or second route reaches the `page` presentation.
- **Zero behavior change is the bar.** Same tabs, filters, contest surfaces, tutorial popovers, quarantine and takedown flows, download and overwrite flows. Any visible difference is a bug.
- **No export-shape, version, or prompt changes.** Pure app-side restructuring.

## Testing Decisions

- **The seam is the host boundary.** Tests mount the host with real providers and real (jsdom-faked) storage services — the GamePanels harness pattern — and assert external behavior: the catalog renders, a download lands in the storage service, download-state flips, auth-dependent affordances follow the auth service, and closing fires the refresh contract.
- **Parity is the point, so parity gets tested:** the in-app path (MainMenu → host → browser) is exercised through the existing dev-route in the e2e suite — open, switch tabs, open details — matching the current behavior. Prior art: the repo's Playwright suite and the Radix-in-jsdom notes for the unit layer.
- **The `page` presentation gets one rendering test** (full-bleed, no dialog overlay) so the future site entry starts from a known-good mode.
- **No mirroring tests.** Nothing asserts prop lists or internal wiring; a test that would break only because plumbing moved is wrong by definition. Guards must bite: each new test is proven by reinstating the bug it guards (the standing bar).
- **Four gates green plus the e2e suite**, run this turn, before done is claimed.

## Out of Scope

- The site browse page itself (the second Vite entry, its route, its deploy). This spec only makes it possible.
- The age gate. It lands in the host later; nothing here builds it.
- Site accounts, server-side age flags, or any FieryLion server coordination.
- Shrinking MainMenu beyond deleting the browser plumbing.
- Any change to the community server calls or catalog caching.

## Further Notes

- The browser subtree already uses no app contexts — the audit found zero context hooks in it or its community components; every coupling is a prop. That is why this decoupling "changes nothing": the data plane moves intact from MainMenu's state to the host's.
- MainMenu's grid may update a beat later than today (on browser close rather than mid-download). That is the same contract the World Editor modal already has; if live mid-browse grid updates ever matter, a storage-service subscription is the follow-up, not more props.
- The future site entry (from the site brainstorm): a second Vite HTML entry mounting this host with `presentation: 'page'`, sharing origin, IndexedDB, and auth with `/play/`. Downloads made on the site page land in the app library with no export/import hop.
