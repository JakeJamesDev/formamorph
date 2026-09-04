# Server Events / Contests — Client Surface Research

Research for the timed-event layer (banner + acknowledge modal + `GET /api/events/active`), the contest
entry toggle in publish, the conditional Contest tab in Community Creations, and the admin Events tab.
All line numbers are as of commit `1ccd0dd`.

---

## 1. Publish flow — where the contest toggle slots in

### How it works today

| Piece | File | Role |
|---|---|---|
| `PublishModal` | `src/components/menu/PublishModal.tsx:41` | Kind-agnostic dialog; receives a ready `PublishPayload`, never builds one |
| `PublishPayload` + per-kind builders | `src/lib/publishPayload.ts:11` (`worldPublishPayload:37`, `entityPublishPayload:57`, `dictionaryPublishPayload:70`) | The one place each kind's fields are mapped |
| `WorldStorageService.publishItem` | `src/services/WorldStorageService.ts:546` | `POST /worlds` (new) or `PUT /worlds/:id` (overwrite); serializes the request body at :564 |
| `usePublishPolicies` | `src/lib/usePublishPolicies.ts:17` | Upload-gate + tag-notice state; fails open, server is authority |
| `TERMS_REQUIRED` intercept | `PublishModal.tsx:99` (catch in `publish()`), code attached at `WorldStorageService.ts:584-588`, constant at `src/services/PolicyService.ts:11` | A 403 with `code: TERMS_REQUIRED` reopens the gate dialog and stashes `pendingTarget` |
| Modal host | `src/views/MainMenu.tsx:448-467` (`openPublish`), mounted at :2444 | Payload state deliberately *not* cleared on close (title flash) |

The publish click path: `handlePublish` (:135) → gate check (`policies.gateBlocks`) → `withTagNotice`
(:117, advisory `PolicyService.matchTags`) → `publish(targetId)` (:84) → `publishItem`.

### Recommended insertion

- **UI:** a Checkbox row inside the ScrollArea body of `PublishModal.tsx` (after the RadioGroup block
  ending :265), shown only while an event with `contest: true` is active. The modal already imports
  Label/Checkbox-adjacent primitives; add `Checkbox` from `@/components/ui/checkbox`.
- **State:** local `useState<boolean>` reset in the open-effect at :167-179 (the modal is mounted for
  the app's lifetime — anything not reset there leaks across publishes, exactly the trap the
  `selectedWorldToOverride` comment at :169-175 documents).
- **Payload:** do **not** widen `PublishPayload` per-kind builders — the flag is publish-time intent, not
  content. Cleanest: add an optional field on `PublishPayload` (`contestEventId?: string`) set by the
  modal before calling `publishItem`, or pass a second options arg to `publishItem`. Either way the wire
  field goes top-level in the JSON body at `WorldStorageService.ts:564` next to `tags`.
- **Active-event knowledge:** mirror `usePublishPolicies` — a small hook fetching `/api/events/active`
  when the modal opens, failing open/hidden on error, with the same `readId` stale-reply guard.

### Traps

- The gate retry path replays `withTagNotice(pendingTarget)` after acceptance (:152) — the contest flag
  must live in state that survives that round-trip, not in a closure argument.
- `publishItem` sends the same body for POST and PUT; a contest flag on a PUT means "move this existing
  listing into the contest" — decide whether overwrite publishes may enter, and gate the checkbox on
  `selectedWorldToOverride === 'new'` if not.
- Server body is shared by all three kinds; if contests are worlds-only, hide the toggle on
  `payload.kind !== 'world'` rather than disabling it (see §6 hide-don't-disable convention).

---

## 2. Community Creations — the conditional Contest tab

### How kind tabs work today

| Piece | Location |
|---|---|
| Kind enum | `src/lib/catalogKinds.ts:8` — `CATALOG_KINDS = ['world', 'entity', 'dictionary']`, doc'd as "Mirrors the server's `config/kinds`" |
| Tab state | `CommunityCreationsBrowser.tsx:129` — `const [browseKind, setBrowseKind] = useState<CatalogKind>(initialKind ?? 'world')` |
| Tab strip | `:381-402` (`kindTabs` fragment) — one `TabsTrigger` per kind, icon-only below 1040px |
| Tabs root | `:595` — `<Tabs value={browseKind}>` with `className="contents"`; empty `TabsContent` stubs for the inactive kinds at :662-664 so `aria-controls` resolves |
| Filter state | `src/lib/useCommunityBrowserFilters.ts:92` — called with `browseKind` at browser `:203-206` |
| Filter persistence | `useCommunityBrowserFilters.ts:14` — one localStorage key `FORMAMORPH_communityFilters`, shape `Record<CatalogKind, KindFilters>` built from `CATALOG_KINDS` (`emptyByKind:43`, `readStoredFilters:51`) |
| Filter bar | `src/components/community/CommunityFilterBar.tsx:37` — pure chip row, takes children slots |
| Dev-router | `src/lib/devRoutes.ts:45` — `community: ['world', 'entity', 'dictionary']`, drift-guarded by `src/lib/devRouter.test.ts` against each surface's exported list |

### What a Contest tab entails

The key design decision: **Contest is not a `CatalogKind`** — it's a *view* (a filter over listings of
any kind carrying a contest marker), and threading it as a fourth kind poisons a lot of plumbing:

- `browseKind` types as `CatalogKind`, which flows into `useCommunityBrowserFilters(… kind)`,
  `kindWorlds` narrowing (`useCommunityBrowserFilters.ts:257`), `KIND_LABELS` lookups (search
  placeholder :417, empty-state copy :685-688, delete dialog :832), and `getUserWorlds(kind)`.
- The persisted filter record is keyed by `CATALOG_KINDS`; `readStoredFilters` silently drops unknown
  keys, so a `contest` key would work but re-seeds to defaults if the tab is later removed (harmless).

**Recommended shape:** widen the browser's local tab type to `CatalogKind | 'contest'` (a new
`BROWSE_TABS` union local to the browser, or a `browseView` alongside `browseKind`), render the Contest
`TabsTrigger` conditionally on an active contest event, and treat the Contest panel as a pre-filter over
`remoteWorlds` exactly like `quarantinedOnly` does (`:190` — `catalogInView`), which is the existing
precedent for "a view over the same catalog, narrowed before paging."

### Traps

- **Persisted state:** if Contest gets its own `KindFilters` slot, extend the record type; if it reuses
  the world tab's filters, a tag filter set there silently narrows the contest view — the per-kind
  isolation comment at `useCommunityBrowserFilters.ts:21-22` explains why sharing is wrong.
- **Dev-router:** `devRoutes.ts:45` must gain `'contest'` *and* the guard test compares against the
  browser's exported tab list — a conditional tab needs the ledger entry even though it may render
  hidden (the router lands on it empty when no event is live; precedent: `profile`/`adminPanel` "open
  empty otherwise rather than failing", `devRoutes.ts:28-30`).
- **Mobile header:** kind tabs share a row with the Filters toggle (`:613-633`); they're icon-only below
  1040px — a fourth tab needs an icon (e.g. Trophy) and will tighten that row on 360px screens; verify
  at mobile preset.
- **aria stubs:** the inactive-kind `TabsContent` stubs at :662 map over `CATALOG_KINDS` — a contest tab
  outside that array needs its own stub or the trigger's `aria-controls` dangles.
- **Empty-state copy** at :684-688 indexes `KIND_LABELS[browseKind]` — a non-kind tab value would throw;
  every `KIND_LABELS[browseKind]` use needs a contest-aware guard.

---

## 3. Messages / inbox — what the announcements and acknowledge modal can reuse

### The message pipeline today

| Piece | File | Notes |
|---|---|---|
| Types | `src/types/messages.ts` — `InboxMessage:21`, `MessageScope:18` (`existing`/`new`/`pinned`), `MessageSeverity:3` (`info`/`warning`/`urgent`) | |
| Service | `src/services/MessageService.ts` — `fetchInbox:50` (limit 50), `fetchUnreadCount:70` (count + `topSeverity` in one call), `markRead:85` (idempotent), `dismiss:95` | |
| Inbox UI | `src/components/menu/MessagesTab.tsx:23` — inside the profile dialog (`AuthModals.tsx:371`), fetches when `active` flips true | |
| Pinned rendering | `MessagesTab.tsx:200-207` — `scope === 'pinned'` swaps the dismiss X for a static Pin icon, `title="Kept by an administrator — this can't be dismissed"` | |
| Unread badge | `MainMenu.tsx:1211-1236` — fetched **once per auth change, no polling interval**; first count of a session raises a toast (:1227-1230) | |
| Badge color | `src/components/community/unreadSeverity.ts` — `UNREAD_KINDS` ladder, `badgeKind()`; badge markup on the profile circle `MainMenu.tsx:1767-1774` | |
| Send side | `BroadcastsTab.tsx` (admin) → `MessageComposerDialog` → `MessageService.send`; `scope: 'pinned'` broadcasts reach accounts created later | |

### For the events feature

- **Start/end announcements riding broadcasts**: server-side sends are already fully supported —
  a broadcast with `scope: 'new'` (dismissible, reaches later accounts) is the natural announcement
  shape; nothing client-side is needed for delivery, badge, or toast. The "cadence" caveat: the client
  only refetches the unread count on auth change (`MainMenu.tsx:1211`), so a mid-session announcement
  is not seen until reload/re-login. If the event banner polls `/api/events/active` anyway, that poll is
  the natural place to also nudge the unread count.
- **Acknowledge modal reusing message read state**: plausible and cheap. `markRead` is idempotent and
  per-user; an event's announcement message id could serve as the acknowledgment record
  (`readAt !== null` = acknowledged). But the inbox fetch is capped at 50 and lives behind the profile
  dialog — the acknowledge modal would want a direct lookup (event carries its `messageId`, client calls
  `markRead` on acknowledge). Alternative: a dedicated `acknowledgedAt` on the event API, mirroring how
  the upload gate keeps `accepted` on `PolicyState` — that is the closer precedent for "modal the server
  remembers you answered" (`usePublishPolicies` + `PolicyService.acceptUploadGate`).

### Traps

- The `onUnreadChange` ref dance in `MessagesTab.tsx:32-39` exists because an inline-arrow callback
  once created a fetch loop that "hammered the server until it fell over" — any new polling hook must
  hold callbacks in refs the same way.
- Inline errors, not toasts, for unreachable-server on dialog open (`MessagesTab.tsx:56-58`) — the event
  banner fetch should follow suit (silent/hidden on failure, like `usePublishPolicies` fails open).

---

## 4. MainMenu layout — where the event banner mounts

### Structure (`src/views/MainMenu.tsx:1383-1898`)

```
<div  pt-[calc(5rem+safe-area)] relative flex flex-col app-viewport overflow-hidden>   :1384
  ├─ fixed top control bar (z-10, out of flow)                                         :1393
  ├─ …dialogs/modals (Settings, PublishModal :2444, CC browser :2452,
  │    AdminPanelDialog :2512, all COMMUNITY_ENABLED-gated at :2425)…
  ├─ <ScrollArea flex-1 min-h-0 container mx-auto>  (one per card type)                :1553/1596/1629/1663
  ├─ mobile bottom tab bar (md:hidden, in-flow, shrink-0)                              :1704
  └─ <footer shrink-0>  profile circle + unread badge :1767 · version · socials        :1727
```

The column is `overflow-hidden` with in-flow `shrink-0` header/footer bands capping a `flex-1` scroll
frame — the documented pattern (comments at :1701-1703 and :1722-1726: "In-flow rather than fixed so it
stacks above the footer instead of covering it").

### Recommended mount

A `shrink-0` banner row **at the top of the flex column, immediately after the root div opens
(:1384-1385, beside `downscaleDialog`)** — but note the root's `pt-[5rem]` padding reserves space for
the *fixed* top bar, so an in-flow banner renders *below* that gap and above the card grid. That is the
right place: it compresses the scroll frame instead of overlapping anything, matches the mobile nav /
footer convention, and needs no z-index. Gate the whole thing on `COMMUNITY_ENABLED` (the
`src/lib/featureFlags.ts` flag — the GitHub Pages build must never fetch events).

For the Community Creations header: the browser is a separate full-screen Dialog; if the banner should
persist there too, mount a second instance inside its header `Collapsible` (`CommunityCreationsBrowser.tsx:598`)
as another `shrink-0` row — the two surfaces don't share a shell.

### Conventions to honor

- **Theme:** no bespoke colors — semantic Tailwind tokens only (`bg-info/10 text-info` etc., as
  `ROLE_BADGE_STYLES` and `MESSAGE_SEVERITY_STYLES` do). The one `dark:` variant in this area is the
  amber warning in PublishModal (:273); severity-tinted banners should reuse
  `MESSAGE_SEVERITY_STYLES` / `UNREAD_MARK_STYLES` rather than invent a palette. Both themes must be
  checked (quality bar).
- **Mobile:** `useIsMobile()` for layout forks; safe-area insets on anything touching viewport edges
  (footer at :1727 is the template). The banner sits between the 5rem top gap and the grid on all sizes,
  so it mostly needs text truncation, not a layout fork.
- **New screen/modal → `devRoutes.ts` entry.** The acknowledge modal needs a `DEV_MODALS` entry (e.g.
  `eventAck`) opening on a canned event when none is live — the `changelog` route's canned-sample
  pattern (`devRoutes.ts:33-35`, `devChangelogSample.ts`) is the exact precedent. The banner itself is
  not a modal but should render from a dev fixture for `verify-ui`.

---

## 5. AdminPanelDialog — adding the Events tab

### The plumbing (`src/components/menu/AdminPanelDialog.tsx`)

| Step | Where |
|---|---|
| Tab enum | `src/components/menu/adminPanelTabs.ts:2` — `ADMIN_PANEL_TABS = ['users', 'broadcasts', 'policies', 'feedback', 'log']`, "Guarded against the dev-router ledger by `devRouter.test.ts`" |
| Role gate | `:42` — `const owner = isAdmin(AuthService.getCurrentUser())`; Broadcasts + Policies are `owner`-only, rest is any staff |
| Trigger | `:74-80` — `TabsList` with `grid-cols-5` / `grid-cols-3` switched on `owner`; owner-only triggers conditionally rendered |
| Panel | `:90-104` — owner-only `TabsContent` wrapped in `{owner && …}`, each with `ScrollArea` and `active={open && tab === 'x'}` fetch gating |
| Escape hatch | `:54-56` — a non-owner pointed at an owner tab (dev-router, or demotion mid-session) is bounced to `users` |
| Dev-router ledger | `devRoutes.ts:52` — `adminPanel: ['users', 'broadcasts', 'policies', 'feedback', 'log']` |

### A new Events tab needs

1. `'events'` appended to `ADMIN_PANEL_TABS` (adminPanelTabs.ts).
2. A `TabsTrigger`/`TabsContent` pair; if admin-only (it composes broadcasts, so yes — same reasoning as
   the :40-41 comment: "speaking to everyone at once… is not moderation"), wrap both in `{owner && …}`,
   bump the grid class to `grid-cols-6` on the owner branch, **and add `'events'` to the bounce list at
   :55**.
3. An `EventsTab` component following the `BroadcastsTab.tsx` template: `active` prop gates fetching, the
   list stays mounted through the close animation (comment at `BroadcastsTab.tsx:36-38` — unmounting on
   `!active` empties the dialog mid-fade).
4. `devRoutes.ts:52` gains `'events'`; `devRouter.test.ts` enforces the lockstep (it will fail until both
   sides agree — that's the drift guard working).
5. If event start/end announcements are composed here, `MessageComposerDialog` already takes
   `initialSubject/initialBody/initialSeverity/initialScope` props (see the quarantine-notice usage at
   `CommunityCreationsBrowser.tsx:864-874`) — prefill rather than rebuild.

---

## 6. Auth / roles on the client

### How identity is exposed

- `src/services/AuthService.ts` — a singleton class, default-exported instance. `token` (public field),
  `isAuthenticated()` (:29, presence check only — never validated per-call), `getCurrentUser():34`
  returning `AuthUser | null` rehydrated from localStorage. **No subscription/event API** — components
  learn of auth changes via props (`MainMenu` owns `isAuthenticated`/`currentUser` state and threads them
  down, e.g. `CommunityCreationsBrowserProps:76-77`).
- `src/lib/roles.ts` — `roleOf():42` (reads `accountType`, defaults `normal`), `isStaff():49`,
  `isAdmin():53`, `canModerate():65`. Header comment :4-5: "The client's copy decides what to *show*; the
  server's decides what to allow."

### The hide-don't-disable pattern (consistent everywhere)

- Signed-out: footer feedback button `{COMMUNITY_ENABLED && isAuthenticated && …}` (`MainMenu.tsx:1780`).
- Role-gated: admin tabs `{owner && <TabsTrigger…>}` (§5); quarantine toggle
  `viewerIsStaff && quarantinedCount > 0 ? … : null` (`CommunityCreationsBrowser.tsx:213`) — note the
  second condition: a control that "can only ever show an empty list … teaches nothing".
- Feature-flag: everything server-touching sits inside `{COMMUNITY_ENABLED && …}` blocks
  (`MainMenu.tsx:2425`, :1730).
- Filter facets: `CommunityFilterBar` takes `signedIn` and *omits* Liked/Mine facets rather than
  disabling them (`CommunityFilterBar.tsx:24-26`).

For events: the banner and Contest tab are read-only and can show signed-out (they read a public
endpoint), but the contest *entry* toggle and admin Events tab follow the patterns above — absent, never
grayed. `MessageComposerDialog`-style admin flows read `AuthService.getCurrentUser()` directly at render
time rather than subscribing.

---

## Cross-cutting reminders

- **Export-shape rule does not bite** (world/save JSON untouched by any of this) *unless* the contest
  flag is stored inside `contentData` — keep it top-level in the publish body and it stays a server-row
  concern.
- **Radix gotchas encountered in these files:** sibling-not-child dialogs (`PublishModal.tsx:296-297` —
  nested dialogs both stuck at `data-state="closed"`); `onOpenAutoFocus={preventDefault}` on popovers
  whose first field opens a suggestion list (`CommunityFilterBar.tsx:55-56`, browser :486-494);
  keep tab panels mounted through close animations (`BroadcastsTab.tsx:36`); `min-w-0` on
  DialogContent-grid children (`AdminPanelDialog.tsx:67`, `AuthModals.tsx:352`); `aria-describedby={undefined}`
  opt-out on description-less dialogs.
- **No polling exists anywhere in this client today** — unread counts are fetch-on-auth-change and
  fetch-on-open. A banner that polls `/api/events/active` introduces the app's first interval; keep it
  slow, clear it on `COMMUNITY_ENABLED === false` and on sign-out-irrelevant (it's public), and hold its
  callbacks in refs (the `MessagesTab.tsx:32` incident).
