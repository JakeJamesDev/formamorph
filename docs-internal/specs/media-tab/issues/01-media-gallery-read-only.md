# 01: Media Gallery, Read-Only

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A new pure module, a new editor tab wired into the list-editor slots, the dev router and the Nav Rail reference, and a card grid with stacking rules. It sets the shapes every later ticket builds on, so Opus.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

The World Editor gets a **Media** tab, after Overview and outside the groups, in both editor modes and in the mobile Sections bar. It shows every media item in the world as cards in a gallery, read-only apart from Download.

**The media index** is a pure, DOM-free module. Given a world, it returns every media item: world thumbnail, Background Music, each world Avatar (with the entities that pick it), each entity gallery image (with its rule rows and gallery position), entity sound and 3D Model, location background and ambient sound, and dictionary thumbnail. Each item carries its kind, parent, slot name, stored size (the UTF-8 byte length of the stored value, so a linked image counts its URL), a linked flag, its image budget from the existing image caps, and an over-budget flag. Helpers group the items into sections by parent (World, World › Avatars, Entities and each entity group, Locations and each location with children, Dictionaries; an entity's or location's items fold into the nearest section) and total them. Later tickets add type grouping, sorting and filters on this module (02), and Optimize Images reads it (03).

**The gallery** (spec P1–P3) shows one section per group-like folder, with its path and total in the header. Each card shows a thumbnail (a kind icon for sounds, 3D Models and Avatars), the parent's name (the slot name for world media), the size or a **Linked** badge, and a rules badge when an image has rules. An over-budget size shows in the warning color. An entity's or location's images stack into one card when there are two or more: the primary image, a count badge, two offset sheets behind it, and the images' total. Sounds and 3D Models never join a stack. Only media that exists shows. Thumbnails load lazily and nothing decodes to measure.

**The item panel** opens for any card: a large preview by kind (image, the shared sound player, the 3D Model viewer, the Avatar viewer), its size and budget, **Download** (embedded bytes under a name built from the parent and slot; a linked image opens its URL), and **Go to <name>** (the entity, location or dictionary by name, or **Go to Overview** for world media). An entity's sound or 3D Model titles itself `<entity> › <slot>`. Clicking a section header opens a section summary: counts and sizes by kind, and the largest items. A stack opens the item panel for its primary for now; ticket 05 replaces that with the image panel.

Every kind shows in both modes (Q26). Copy never says "owner".

Ship with it: a dev-router entry for the tab, the Nav Rail reference body line, a **Media tab** glossary entry in `CONTEXT.md`, and a new wiki page for the tab linked from the World Editor page. A changelog fragment covers the tab's arrival.

## Acceptance criteria

- [x] The media index finds every kind listed above in a fixture world, with the right parent and slot for each — `mediaIndex.test.ts` "finds every media kind…"
- [x] Each Avatar appears once, with the entities that pick it — `mediaIndex.test.ts` "lists each Avatar once…"; mutation (Avatar twice) fails it
- [x] The index's stored sizes for a world sum to within that world's non-media JSON bytes of the publish measure (a test states the bound) — `mediaIndex.test.ts` "sums to the publish measure…": publish − Σ equals the media-emptied world exactly
- [x] Linked images are flagged and count only their URL's bytes — `mediaIndex.test.ts` "flags a linked image…" (non-ASCII URL)
- [x] Over-budget flags follow the image caps by kind; sounds, 3D Models and Avatars never flag — `mediaIndex.test.ts` "flags images over the cap…"
- [x] Sections follow entity groups and location nesting; a parent with no media makes no card — `mediaIndex.test.ts` "follows entity groups…"; `WorldEditor.mediaTab.test.tsx` Crew has no section
- [x] The tab shows after Overview in Simple and Advanced, on desktop and in the mobile Sections bar — `WorldEditor.tabNavigation.test.tsx` rail rows both modes + Sections bar equals rail; mobile frame
- [x] An entity with three images shows one stack card with a count of 3 and the images' total; its sound is a separate card under the same name — `WorldEditor.mediaTab.test.tsx` "stacks an entity's three images…"
- [x] A one-image entity shows a plain card — `WorldEditor.mediaTab.test.tsx` "shows a one-image entity as a plain card…"
- [x] Avatars, 3D Models and Ambient Sound cards show in Simple mode — `WorldEditor.mediaTab.test.tsx` "shows Avatars, 3D Models and Ambient Sound in Simple mode"
- [x] Clicking a card opens the item panel with the right preview, size, Download and Go to <name> — `WorldEditor.mediaTab.test.tsx` "Media tab panels" (image, sound player, 3D Model viewer, Avatar Used By, Download file name)
- [x] Go to <name> lands on the entity, location, dictionary or Overview that holds the item — `WorldEditor.mediaTab.test.tsx` "Media tab Go to" (4 cases)
- [x] `window.__fmDev.goto('worldEditor', { tab: 'media' })` opens the tab — `devRouter.test.ts` ledger matches `WORLD_EDITOR_TABS`; tab opened in the preview
- [x] Frames: `.scratch/frames/media-gallery-dark.png` and `.scratch/frames/media-gallery-light.png` at 1600×900 on a world with stacks; `.scratch/frames/media-gallery-mobile.png` at 390×844 — Playwright captures on a Fantasy Futanari copy with two stacked entities

For you: open a large world's Media tab and judge whether the stacks and section totals make the heavy parts obvious.

## Landed

**Not verified**

- None. The `__fmDev.goto` criterion rests on the dev-router ledger test and opening the tab by hand in the preview, not on a `goto` call from a test.

**For you**

- Open a large world's Media tab and judge whether the stacks and section totals make the heavy parts obvious. Frames: `.scratch/media-tab-01/frames/media-gallery-dark.png`, `.scratch/media-tab-01/frames/media-gallery-light.png`, `.scratch/media-tab-01/frames/media-gallery-mobile.png`.
- The location panel already has a **Media** tab (Background Image, Ambient Sound), so the editor now shows two tabs named Media while a location is open. One tour test needed scoping for it. Judge whether the location tab wants another name.
- Neither bundled-style world in `worlds-wip/` has an entity with two or more images, so the frames use a copy with stacks added. Check a real gallery-heavy world when one exists.
