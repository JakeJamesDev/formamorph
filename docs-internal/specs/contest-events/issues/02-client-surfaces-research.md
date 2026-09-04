# 02 — Client surfaces research

Type: research
Status: done

## Question

Map the client-side surfaces the feature will touch, so the API-contract and prototype tickets are grounded:

1. The publish flow — where `PublishModal.tsx` gathers metadata and calls `WorldStorageService`, and where an "Enter into contest" toggle would slot in (including the upload-gate/policy interception point, as the entry toggle rides the same request).
2. Community Creations tab structure — how kind tabs (Worlds/Entities/Dictionaries) are defined in `CommunityCreationsBrowser.tsx`, how a conditional "Contest" tab would mount, and how per-kind filter state (`useCommunityBrowserFilters`) would or wouldn't apply to it.
3. Message/inbox rendering — how pinned broadcasts and severity badges reach the user today (unread-count polling cadence, where the inbox modal lives), since the start/end announcements ride broadcasts.
4. Main menu banner mount point — where a persistent event banner fits in `MainMenu.tsx` layout (and the CC header), both themes, mobile included.
5. AdminPanelDialog tab plumbing — how tabs register, which role gates each, and what an Events/Contests tab needs to slot in.
6. How the client learns "who am I / what role" (`AuthService`, `roles.ts`) for gating the entry toggle and admin tab.

## Answer

Findings file: [research/client-surfaces.md](../research/client-surfaces.md) (resolved 2026-08-20 by subagent). Key findings:

1. **Publish flow**: `PublishModal.tsx` is payload-agnostic — payloads built in `lib/publishPayload.ts`, upload via `WorldStorageService.publishItem`; the 403 `TERMS_REQUIRED` intercept is in `PublishModal.tsx`. Contest toggle = a Checkbox in the modal body; flag goes **top-level in the publish JSON body** (next to `tags`), never inside `contentData` — keeps export-shape rules out of it. Traps: modal is mounted for the app's lifetime (flag must reset in the open-effect) and must survive the gate-accept retry (`pendingTarget` replay).
2. **CC tabs**: Contest must NOT be a fourth `CatalogKind` (poisons `KIND_LABELS`, per-kind persisted filters, `getUserWorlds`) — model it like the `quarantinedOnly` pre-filter view: widened local tab union, aria `TabsContent` stub, an icon (tabs are icon-only <1040px), `devRoutes.ts` entry (drift-guarded).
3. **Messages**: no polling — unread count fetched once per auth change with a one-time toast. Pinned = Pin icon replacing the dismiss X. `scope:'new'` broadcasts are the natural start/end announcements (zero client work). Acknowledge state: upload gate's server-remembered `accepted` is the closer precedent than message `readAt`, though `markRead` is idempotent and could serve.
4. **Banner mount**: MainMenu is a flex column of `shrink-0` bands; mount the banner as a `shrink-0` row right after the root div, below the fixed top bar's 5rem. Gate on `COMMUNITY_ENABLED`. CC browser is a separate full-screen dialog — second instance in its header. Colors via semantic tokens (`MESSAGE_SEVERITY_STYLES`).
5. **Admin Events tab**: append to `ADMIN_PANEL_TABS`, conditional on `owner` (=`isAdmin`), bump `grid-cols-5`→6, extend the non-owner bounce, add to `devRoutes.ts`, follow `BroadcastsTab` (keep mounted, `active` gates fetch). `MessageComposerDialog` accepts `initialSubject/Body/Severity/Scope` for prefills.
6. **Auth/roles**: `AuthService` singleton (no subscription API — auth flows down as props); `roles.ts` gives `isStaff`/`isAdmin`; codebase pattern is uniformly hide-never-disable.
