# Image URLs — spec

**Goal:** let an author point an image field at a remote URL instead of embedding the bytes, so a
published world's payload stays small. Remote images render as-is during play; the bytes are fetched
and embedded only at the moments where a file has to be self-contained.

**Status:** spec, not built.

---

## 1. Storage — no export-shape change

Every image field already stores a bare `string`. A URL is just a different kind of string, so:

- `Entity.images?: Base64Data[]` ([world.ts:128](../src/types/world.ts:128)) is unchanged.
- `worldOverview.thumbnail`, location backgrounds, dictionary thumbnails — all unchanged.
- Kind is discriminated by **prefix**, not by a new field: `/^https?:\/\//i` is remote, anything else
  is embedded.

> ⚠️ **This is the deliberate design choice.** A per-slot `{ kind, value }` object would be tidier but
> changes the world/save JSON shape, which forces a version bump and a migration. Prefix
> discrimination avoids all of it — worlds written before this feature stay valid, and a world using
> it still loads in an older build (the images just 404 rather than corrupting the file).

New shared helper, `src/lib/imageSource.ts`:

```ts
export const isRemoteImage = (url: string) => /^https?:\/\//i.test(url);
```

`Base64Data`'s TSDoc gets one line noting the value may also be an `http(s)` URL.

---

## 2. Authoring UI

The URL box goes on **`ImageUpload`** ([UtilityComponents.tsx:98](../src/lib/UtilityComponents.tsx:98)),
not on `ImageTagsField` — that single change gives every image surface the feature at once:

| Surface | File |
|---|---|
| Entity gallery | [EntityFields.tsx:113](../src/managers/EntityFields.tsx:113) |
| World cover | [WorldOverviewManager.tsx:201](../src/managers/WorldOverviewManager.tsx:201) |
| Location background | [LocationManager.tsx:89](../src/managers/LocationManager.tsx:89) |
| Dictionary thumbnail | [DictionaryOverviewManager.tsx:26](../src/managers/DictionaryOverviewManager.tsx:26) |

**Layout.** Under the dashed dropzone, a single-line row: a text `Input` with placeholder
`Or paste an image URL` plus a **Use** button. Submitting on `Enter` too. The row is hidden while
the slot is filled — a filled slot is replaced by removing it first, which is the existing behavior.

**On submit:**

1. Trim. Reject anything not matching `^https?://` with an inline message (`Enter a link starting
   with http:// or https://`). No other validation — we cannot tell a real image from a 404 without
   fetching, and fetching defeats the point.
2. Store the string verbatim via `onChange`. **No `promptImage` downscale pass** — the cap governs
   payload bytes, and a remote URL contributes none.
3. Show it in the preview `<img>`, which already works untouched.

**Preview failure.** A remote image that fails to load gets an `onError` swap to a muted
"Couldn't load this image" frame with the URL shown, so a typo is visible at authoring time instead
of at play time. Embedded values keep today's behavior.

**Badge.** A filled remote slot shows a small link icon in the corner opposite the remove button, so
an author can tell at a glance which slots are remote. Title text: the URL.

---

## 3. What changes at read time

Nothing. `<img src>` needs no CORS, so [EntityVisual.tsx:159](../src/components/game/EntityVisual.tsx:159),
`SwipeImage`, and `ImageZoomViewer` all render a remote URL as they stand. No read-path edits.

**Size budgeting** already degrades correctly: the measure worker's fetch fails cross-origin,
[imageOptim.ts:41](../src/lib/imageOptim.ts:41) catches it and treats the image as within budget.
That is the right answer — a remote image costs the payload nothing. Two touch-ups so it is
intentional rather than incidental:

- `oversizedItem` skips remote URLs before calling the worker (saves a doomed fetch per image).
- The World Doctor / optimize scans report remote images in their own line rather than silently
  omitting them.

---

## 4. Embedding at export

`fetchAsDataUrl(url, cap)` in `src/lib/imageSource.ts`: `fetch` → `blob` → `FileReader` data URL →
existing `optimizeImageDataUrl` against the cap. Rejects on network failure, non-2xx, a
non-`image/*` content type, or a CORS block.

> **CORS is the load-bearing risk — on web only.** `fetch` needs permissive
> `Access-Control-Allow-Origin`, which `<img>` does not. An image that renders perfectly in play can
> still be un-embeddable in a browser. Every path below therefore needs a real failure story, not a
> `catch {}`.
>
> **The desktop build has no such limit.** [corsShim.cjs](../electron/corsShim.cjs) rewrites every
> external `http(s)` response with permissive CORS headers, so embedding and caching work against any
> host there. Card export and the image cache are therefore *more capable on desktop than on web* —
> worth stating in the failure message rather than leaving a web user guessing.

### Where it fires

| Boundary | Behavior |
|---|---|
| **Character card** — [entityFile.ts:121](../src/lib/entityFile.ts:121) | **Must embed.** The card *is* the pixels. Remote primary → `fetchAsDataUrl` before the WebP encode |
| **World JSON export** — [WorldEditor.tsx:158](../src/views/WorldEditor.tsx:158) | Author chooses (see below) |
| **Backup bundle** — [backup.ts:221](../src/lib/backup.ts:221) | Keep URLs. A backup restores onto a machine with a connection; embedding would bloat it enormously |
| **Publish** — [publishPayload.ts](../src/lib/publishPayload.ts) | **Keep URLs — never embed.** This is the entire point of the feature |

### Character card failure path

`exportEntityCard` currently throws a bare `'Could not encode the portrait as WebP.'`
([entityFile.ts:126](../src/lib/entityFile.ts:126)). With a remote primary the likely cause is CORS,
so the thrown message must say which: *"Couldn't download this character's portrait from `<host>` —
the site may not allow it. Upload the image as a file to export a card."* Callers
([WorldEditor.tsx:171](../src/views/WorldEditor.tsx:171),
[EntityEditorModal.tsx:101](../src/components/modals/EntityEditorModal.tsx:101)) already surface a
toast; they just need the better text.

Deliberately **not** falling back to the generated placeholder portrait — silently shipping a card
with the wrong face is worse than a failed export the author can act on.

### World JSON export — the choice

When a world about to export contains ≥1 remote image, a dialog offers:

- **Keep links** *(default)* — small file, needs a connection to view.
- **Download and embed** — self-contained, large. Runs `fetchAsDataUrl` over every remote image
  with a progress count, then lists any that failed and asks whether to export anyway (those slots
  keep their URLs).

No remote images → no dialog, exactly as today.

---

## 5. Offline — client-side blob cache

Remote images are cached on the client so a world stays playable offline after one online visit.
This costs the server nothing: the cache is a **separate IndexedDB store keyed by URL** and is never
written back into `images[]`, `worldOverview.thumbnail`, or any other authored field.

> ⚠️ **The one hard boundary.** A cached blob must never reach a world record, an export, or a
> publish payload. Cache lookup happens at *render* time only. Violating this silently re-embeds the
> bytes the feature exists to avoid — hence the publish-payload regression test in §6.

**Mirror the existing precedent**, don't invent one:
[useCachedThumbnail.tsx](../src/lib/useCachedThumbnail.tsx) + `thumbnailCache` already do exactly
this for community thumbnails — IndexedDB blob store, fetch on miss, `URL.createObjectURL`, revoke
on unmount, and a fallback to the direct URL on any network/CORS/quota error. New
`useRemoteImage(url)` hook in the same shape, backed by its own store; `EntityVisual`, `SwipeImage`,
`ImageZoomViewer`, and the `ImageUpload` preview resolve through it.

**Caching is best-effort, and that is fine.** `fetch` needs CORS; `<img>` does not. A host that
blocks CORS simply never caches and always renders live — degraded offline, never broken online.

**Eviction:** LRU by last-read, capped at ~100 MB. Without a cap a long-lived install grows without
bound, and browsers evict the whole origin's storage under pressure — which would take saves and
worlds with it. A "Clear cached images" row in Settings → Storage alongside the existing controls.

**Out of scope:** pre-warming a whole world's images on download. Worth having, but it's a
progress-UI job of its own and offline works without it after a normal playthrough.

---

## 6. Tests

- `isRemoteImage` — `http`, `https`, uppercase scheme, `data:`, blank, a bare path.
- `ImageUpload` — URL submit stores verbatim; rejects a non-http string; no downscale prompt fires
  for a URL; a file upload still prompts.
- `oversizedItem` skips a remote URL without calling the worker.
- `exportEntityCard` with a remote primary: embeds on a successful fetch; throws the host-named
  message on a CORS/network failure. **Both directions** — a test that only proves the happy path
  does not guard the failure text.
- World export: the dialog appears only with ≥1 remote image; "keep links" leaves the JSON
  byte-identical to today's.
- Publish payload keeps a remote `thumbnail` verbatim — the regression guard for the feature's
  whole purpose.
- **Cache never leaks into stored data:** with a populated image cache, the publish payload, world
  JSON export, and the saved world record all still carry the URL, not a blob or data URI. This is
  the §5 boundary; without this test a later refactor can silently undo the whole feature.
- `useRemoteImage` falls back to the live URL on a fetch rejection, and revokes its object URL on
  unmount (the leak the thumbnail hook already guards).

---

## 7. Changelog

One 👤 user-facing **Added** entry under 🚧 In Progress. The framing that matters to an author:
paste a link instead of uploading, keeps published worlds small, needs a connection to view, and
character cards download the picture when you export one.
