# VRM Model Library — design spec

Promote the existing model store into a first-class library card type, alongside Worlds, Entities, and Dictionaries.

**Status:** spec agreed, not built. **Scope:** UI + metadata layer only — the storage already exists.

---

## 1. What already exists

`src/lib/modelLibrary.ts` is already a Blob-backed IndexedDB store and already made the right call (its header comment: Blobs are "lighter than base64 for multi-MB files; GLTFLoader accepts the resulting `blob:` URLs").

| Piece | Where | State |
|---|---|---|
| DB `FORMAMORPH_MODELS_DB` / store `models` | `lib/modelLibrary.ts` | ✅ done |
| `addModel` / `getAllModels` / `getModel` / `deleteModel` | `lib/modelLibrary.ts` | ✅ done |
| `PlayerModel` record type | `types/gameplay.ts:73` | needs 2 fields |
| URL resolution chokepoint | `lib/usePlayerModelUrl.ts:12-41` | ✅ done |
| Library card UI | — | ❌ to build |
| Import/export file handling | — | ❌ to build |
| Metadata (thumbnail, license) | — | ❌ to build |

Today the store is reachable **only** from a `<Select>` in `CharacterCustomization.tsx:257`.

### Explicitly out of scope

`WorldOverview.customPlayerVRM` stays as-is — a base64 data-URL inside the world JSON (`types/world.ts:244`). It is the worse of the two VRM paths (~33% inflation, rides inside `StoredWorldRecord.data`, lands in the exported `.json`, POSTed on publish), but converting it to a `{ modelId }` reference is an **export-shape change** and is deferred to its own decision.

---

## 2. Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Scope | Promote the existing library only. Worlds/entities unchanged. |
| 2 | Thumbnail | Embedded VRM meta thumbnail → fallback to headless offscreen WebP portrait snapshot |
| 3 | Export | Re-export the raw `.vrm` bytes, unchanged |
| 4 | License enforcement | **Display only.** No export gating. |
| 5 | Missing license | Treat as unknown, allow. Show "License: unknown". |
| 6 | `.glb` files | Accept, but badge as limited (no meta, no license, morphs not guaranteed) |
| 7 | `creditNotation: required` | Surface on card/details only |
| 8 | Bundled default | Seed as a real record |
| 9 | **Deletion invariant** | **The library must always hold ≥1 model.** Block deleting the last one — not the default specifically. |
| 10 | Backfill | Lazy, per card on first view |
| 11 | Delete-in-use | Warn then allow; scan all saves |
| 12 | Duplicate import | Content-hash; on match, offer replace-or-duplicate |
| 13 | `'default'` sentinel | Migrate saves to the seeded record's real id ⚠️ *see §5* |
| 14 | Card click | Opens a 3D preview (VRMViewer) |

---

## 3. Data model

Two fields added to `PlayerModel` (`types/gameplay.ts:73`):

```ts
interface PlayerModel {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  size: number;
  addedAt: number;
  thumbnail?: string;      // WebP data-URL, lazily resolved
  license?: VrmLicense;    // normalized, lazily resolved
  hash?: string;           // content hash for duplicate detection
}
```

Local IndexedDB only — **not** an export shape. No app-version bump.

### The normalized license type

VRM 0.0 and VRM 1.0 metadata are genuinely incompatible. Verified against `@pixiv/three-vrm@3.1.0` types (`three-vrm-core/types/meta/`). `vrm.meta` is `VRM0Meta | VRM1Meta`, discriminated by `metaVersion: '0' | '1'`.

| Concern | VRM 0.0 | VRM 1.0 |
|---|---|---|
| Thumbnail | `texture?: THREE.Texture` | `thumbnailImage?: HTMLImageElement` |
| Title | `title?` | `name` (required) |
| Author | `author?: string` | `authors: string[]` |
| Redistribution | `licenseName: 'Redistribution_Prohibited'` | `allowRedistribution?: boolean` |
| Commercial | `commercialUssageName: 'Allow' \| 'Disallow'` *(sic)* | `commercialUsage: 'personalNonProfit' \| 'personalProfit' \| 'corporation'` |
| Avatar use | `allowedUserName` | `avatarPermission` |
| Credit | — | `creditNotation: 'required' \| 'unnecessary'` |
| License doc | `otherLicenseUrl?` | `licenseUrl` (required) |

Both map into one internal shape, every field optional so "unknown" is representable:

```ts
interface VrmLicense {
  metaVersion: '0' | '1' | null;   // null = .glb, no meta at all
  title?: string;
  authors?: string[];
  licenseName?: string;
  licenseUrl?: string;
  allowRedistribution?: boolean;
  commercialUse?: 'allow' | 'disallow' | 'personalNonProfit' | 'personalProfit' | 'corporation';
  creditRequired?: boolean;
}
```

**All VRM 0.0 meta fields are optional** — a VRM legally carries no license info. `metaVersion: null` covers `.glb`.

---

## 4. Gotchas (verified, not assumed)

1. **Thumbnails are off by default.** `VRMMetaLoaderPluginOptions.needThumbnailImage` defaults to `false`, and the loader at `VRMViewer.tsx:449` doesn't pass it. The library's import loader must opt in; VRMViewer's playback loader should *not* (needless cost).
2. **Two thumbnail types.** VRM0 gives `THREE.Texture`, VRM1 gives `HTMLImageElement` → two extraction paths before the render fallback.
3. **`acceptLicenseUrls` throws.** VRM1's `licenseUrl` is required and the meta loader *throws* if it isn't in the accepted list. Import must configure this or catch — otherwise a legitimate VRM fails to load entirely.
4. **No shared library abstraction.** Worlds/entities/dictionaries are copy-adapted — each has its own storage service, `MainMenu` import branch, editor modal, and order key. A 4th type duplicates that surface. (`EntityStorageService.ts:13` literally says "Mirrors `DictionaryStorageService`".)
5. **No "New" button.** You can't author a VRM — this card type is import-only, the first asymmetry in the library UI.
6. **Headless load precedent exists.** `lib/vrmMorphLoader.ts` already loads a VRM with no scene/renderer and disposes it (`disposeGltf`) — the thumbnail-snapshot fallback should follow it, but needs a renderer, unlike the morph reader.
7. **Adjacent perf trap.** `getWorldMetadata()` calls `store.getAll()` and projects in JS — the full `data` (incl. base64 VRMs) deserializes on every library render. Pre-existing; do **not** copy the pattern into the model library. `getAllModels()` returning Blobs is fine (Blobs are lazy), but thumbnails must not be re-derived per render.

---

## 5. ⚠️ Save-shape change — approved, implemented

**Decision 13 (migrate `playerModelId: 'default'` → the seeded record's real id) modifies the save envelope.** Confirmed by the user 2026-07-17 after the alternative (a read-time alias) was offered and declined.

`CharacterData.playerModelId` had three meanings: a library id, the `'default'` sentinel, or unset/`'world'`. The sentinel now resolves to `DEFAULT_MODEL_ID` (`'default-model'`), the seeded record's fixed id.

**How it lands:** `migrateSave` rewrites the sentinel on `currentState` and every `stateHistory` snapshot, as a presence-based pass alongside the existing history cleanup. It's the single path both load and import already run, so the two can't drift. `migrateSave` is pure — old saves are rewritten in memory on load and persist the new value on their next save, so nothing is rewritten behind the player's back.

**Backwards compatibility:** reading an old save is unaffected (the sentinel migrates on the way in), and `usePlayerModelUrl` still honours `'default'` for state that hasn't been through a save round-trip. A save naming a *deleted* model — the seeded default included — falls back to the bundled file.

**Still the user's call:** whether this warrants a version bump. The spec does not assume one.

---

## 6. Build order

1. **Metadata layer** — `vrmMeta.ts`: load a VRM headlessly, normalize `VRM0Meta | VRM1Meta` → `VrmLicense`, extract the embedded thumbnail.
2. **Thumbnail fallback** — offscreen render → WebP portrait, following `vrmMorphLoader.ts`'s dispose discipline.
3. **Storage** — extend `PlayerModel`, add hashing, lazy backfill, the ≥1-model deletion invariant.
4. **Library UI** — `cardType: 'models'` branch in `MainMenu.tsx`, portrait `SortableWorldCard`, `MODEL_ORDER_KEY`, import-only button, GLB badge.
5. **Details + preview** — 3D preview on card click; license/author/credit/size display.
6. **Export** — raw `.vrm` bytes back out.
7. **Delete-in-use** — all-saves reference scan → warning copy.
8. **Default seeding** — seed `default-model.vrm` as a real record; resolve the `'default'` sentinel per §5.

Each step ends four gates green + `graphify update .`.
