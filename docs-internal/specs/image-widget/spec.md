# Image Widget Polish — Spec

Status: done

Three changes to the entity/location image widget: **drag-and-drop**, **one gallery pane instead of stacked dropzones**, and a **progress overlay while images are converted**.

Decided in interview; this doc is the agreed shape before any code is written.

---

## Where each piece lives

| Piece | Component | Reaches |
|---|---|---|
| Drag-and-drop | `ImageUpload` ([UtilityComponents.tsx:103](src/lib/UtilityComponents.tsx:103)) | Every uploader — entities, locations, world thumbnail, dictionary |
| Progress overlay | `ImageUpload` | Same |
| Gallery pane | `ImageTagsField` ([ImageTagsField.tsx:52](src/managers/ImageTagsField.tsx:52)) | Multi-slot subjects only |

Single-slot callers keep looking like one dropzone — they simply gain drop and progress.

---

## 1 · Drag-and-drop

**Accepts**

- 🗂️ **Image files from the OS** — one or many.
- 🌐 **An image dragged out of a browser tab** — the drag carries a URL, which stores as a *linked* image exactly as pasting into the URL box does. Costs no payload bytes and skips the encode pass entirely.

**Lands**

Consecutive **empty** slots, in drop order, stopping at the slot count. Files beyond the embedded-bytes allowance (`embeddedLimit`) are rejected with the same message the blocked picker already shows; URLs are never blocked by it.

**Does not replace.** Dropping onto a filled tile does nothing — replacing a picture still means removing it first. (Declined deliberately: a drop that silently overwrites the primary is hard to undo.)

**Feedback**

The pane highlights while a valid drag is over it, and rejects a drag carrying nothing usable rather than accepting and failing silently.

---

## 2 · One gallery pane

Replaces the current vertical stack of full dropzones with:

```
┌─────────────────────────┐
│                         │
│    primary preview      │   ← large; the picture that stands in for the subject
│                         │
└─────────────────────────┘
 [img] [img] [img] [ + ]      ← strip; last tile adds
```

- **Strip tile click** → previews that image in the large frame. Preview only; it does *not* reorder anything.
- **Make Primary** stays an explicit action on the previewed non-primary image, so promotion is never accidental.
- **Remove** stays per-image.
- **The `+` tile is the only add affordance**: click opens the file picker, drop targets it, and it reveals the URL box. It disappears when the slots are full.

Single-slot callers render the large frame alone, with no strip.

---

## 3 · Conversion progress

Encoding runs one-shot in a worker ([imageOptim.ts:67](src/lib/imageOptim.ts:67)) and reports nothing in between, so:

| Case | Bar |
|---|---|
| One image | **Indeterminate** — there is genuinely no percentage to show |
| Several dropped at once | **Determinate**, counting files (`2 of 5`) |

Either way the **source thumbnail sits behind the bar, dimmed**, so it is obvious *which* picture is being worked on. The tile is not interactive while it converts.

> ⚠️ Making the single-image bar determinate would mean instrumenting the worker to report decode/resize/encode stages — deliberately out of scope, for a bar that finishes in well under a second.

---

## 4 · Downscale consent

Today `useDownscalePrompt` asks per image. A five-file drop would raise five modals.

**One dialog per batch**: it names how many of the dropped images are oversized and the total saving, and the answer applies to all of them. **Cancel keeps every one full-size** — the existing per-image semantics, just decided once.

---

## Out of scope

- Reordering the strip by dragging (only Make Primary moves anything)
- Dropping onto a filled tile to replace it
- Real per-stage progress inside the encode worker
- The scene-image panel in gameplay ([SceneImagePanel.tsx](src/components/game/SceneImagePanel.tsx)) — a different surface with its own browsing model

## Not an export-shape change

`Entity.images[]` already holds the list; nothing about the stored world or save JSON changes.
