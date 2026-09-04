# 14 — WebP image rule + async Fix + Optimize popup honesty

Status: ready-for-agent

## Problem Statement

A world's images silently carry avoidable weight. PNGs and GIFs an author pasted in stay in their
original format forever unless the author happens to run the footer's Optimize flow — nothing ever
*tells* them the world could be smaller for free. Worse, the Optimize popup over-promises: its copy
offers to "convert to lossless WebP" and estimates a shrink over images the encoder's grow-guard
will silently keep (a JPEG's lossless WebP is usually *larger*, so the original is kept and the
popup makes the same broken offer next time). An author who accepted Optimize during a community
download reasonably believes their images are WebP; the popup then contradicts them, and neither
the popup nor the run ever says which images were actually left alone.

## Solution

A World Doctor rule that flags images stored in a format a lossless WebP conversion genuinely
improves (PNG, GIF, BMP — never JPEG or SVG, where no free win exists), with a working Fix that
runs the real encoder and writes the converted world back like any other quick fix. And an honest
Optimize popup: its conversion claim and size estimate count only the images the run can actually
convert, and a run that kept images (grow-guard) says so once instead of silently no-opping.

## User Stories

1. As an author, I want the World Doctor to tell me when images are stored in a format that converts losslessly to something smaller, so that my world doesn't carry avoidable weight I never knew about.
2. As an author, I want the finding to name each image's owner (entity, location, or the world thumbnail) as a way in, so that I can jump to the item that holds it like any other finding.
3. As an author, I want a Fix on that row that actually performs the conversion, so that shrinking the world is one click rather than a trip to a separate flow.
4. As an author, I want the Fix to preserve animation when it converts a GIF, so that fixing never costs me what the image does.
5. As an author on a browser that can't re-encode animation, I want animated images skipped rather than flattened, so that a Fix is never destructive.
6. As an author, I want the fixed world written back as a normal edit — dirty flag set, Exit Without Saving still the undo — so that a conversion I regret is recoverable like any hand edit.
7. As an author, I want to be told when the Fix kept images that would have grown, so that a row that doesn't fully clear reads as a fact about my images rather than a broken button.
8. As an author, I want JPEG photos left out of the findings entirely, so that I'm never nagged toward a conversion that would grow the file or cost quality.
9. As an author, I want SVGs left out of the findings entirely, so that I'm never pushed to trade a tiny scalable image for a bigger raster one.
10. As an author, I want linked (remote-URL) images left out, so that the rule only speaks about bytes my world actually carries.
11. As an author, I want the rule to run in the live pass like the other structural checks, so that pasting a PNG surfaces the finding a moment later without a button press.
12. As an author, I want the finding to count as one row per rule with the usual severity/seen/dismiss behavior, so that twelve PNGs read as one problem and the badge stays trustworthy.
13. As an author triaging in the Bench Popover, I want the row and its Fix to work there exactly as in the panel, so that a routine conversion doesn't force the full panel open.
14. As an author reading the Optimize popup, I want its "convert to lossless WebP" claim and size estimate to cover only the images the run can actually convert, so that the offer matches what accepting it does.
15. As an author whose images are all JPEG/WebP already, I want the popup to stop offering Optimize at all, so that the only offered action is one that does something.
16. As an author who accepts Optimize, I want a one-time report when the run kept images that would have grown, so that "I converted my images" and "the popup still says otherwise" can never both feel true.
17. As an author on a first fix to a never-edited downloaded copy, I want the usual downloaded-copy divergence note, so that this fix behaves like every other fix.
18. As an author who edits the world while a Fix is running, I want the stale result dropped, so that a conversion of images that no longer exist can never land.
19. As a developer, I want one shared "is this mime losslessly convertible" predicate used by the rule, the Fix, and the popup, so that the three surfaces can never disagree about what counts.

## Implementation Decisions

- **One convertibility predicate, one module.** A pure helper in the image-bytes layer answers
  "does a lossless WebP conversion genuinely improve this mime?" — true for PNG/GIF/BMP, false for
  JPEG (lossless grows it, lossy degrades it), SVG (raster copy is bigger and loses scalability;
  the pipeline's worker decode can't even read SVG — verified live), WebP itself, and anything
  unrecognized. The rule, the async fix, and the popup all import it; no surface hand-rolls a mime
  list.
- **The rule** (`image-not-webp`, severity info) is a pure sync scan: walk the same image slots the
  optimize pipeline walks (world thumbnail, every entity gallery image, location backgrounds), read
  each data-URL's mime prefix, flag convertible ones. Remote URLs skipped. No decoding, no worker —
  cheap enough for the live debounced pass. Items carry the owning entity/location (thumbnail →
  overview) so each name is a way in, per the standard row shape.
- **The Fix is async and lives beside the rule seam, not inside it.** `fix()` on the rule registry
  stays pure/sync and this rule doesn't have one; instead the Bench hook exposes an on-demand
  async action (the stat-code check is the precedent) that the row's Fix button invokes. It
  re-derives the convertible slots from the world *at click time*, runs the existing lossless
  re-encode (same resolution, animation-preserving path included) per slot, and writes each changed
  slice back through the same setters the sync fixes use — world dirty, discard-as-undo, and the
  downloaded-copy first-edit note all inherited.
- **A Fix result only lands if it is actually WebP.** The encoder falls back to lossy JPEG when
  WebP encoding is unavailable; a "lossless" fix must never do that, so non-WebP outcomes keep the
  original.
- **Animation is never flattened.** The encoder already re-encodes animated GIF/WebP to animated
  WebP frame-by-frame; where the animated decode path is unavailable (no WebCodecs ImageDecoder,
  e.g. Safari) the fix conservatively skips GIFs entirely rather than risk the static path.
- **Stale runs drop.** The same run-guard shape as the stat-code check: a run started against a
  world the author has since edited discards its result. One run at a time; the button shows a
  running state and disables meanwhile.
- **Kept images are reported, not hidden.** The grow-guard can keep a PNG whose WebP came out
  larger; the finding for it will persist. After a run, if anything was kept, one toast says how
  many and why — the same wording decision as the popup's post-run report, so the two flows sound
  like one feature.
- **Popup honesty, two halves.** (1) The offer: `canOptimize` and the Optimize size estimate count
  only convertible images — JPEGs count at their original bytes and can no longer make the popup
  promise conversion; all-JPEG/WebP worlds get no Optimize option at all. (2) The run: when the
  grow-guard kept images, one toast reports it. Both halves use the shared predicate.
- **Unchanged:** the rule registry seam, fix purity for every other rule, seen/dismissed storage
  shape, badge math, the Downscale path, the popover (the row appears there automatically since it
  renders the same World Doctor list).
- No export-shape impact; no new persistent state.

## Testing Decisions

- Good tests assert author-visible behavior at existing seams; three seams, no new ones:
  1. **The rule:** the rules fixture/registry tests — a world with a PNG entity image, a GIF
     background, a JPEG, an SVG, and a remote URL yields exactly the PNG+GIF findings. The
     predicate's exemptions are proven by the JPEG/SVG absences, not by unit-testing the predicate
     against a mime list it mirrors.
  2. **The async Fix:** the WorldEditor bench harness with the encode call stubbed (exactly how
     `checkStatCode` is stubbed) — Fix converts and writes back through context (mime observably
     WebP, world dirty), stale-run result dropped after a mid-run edit, non-WebP encoder outcome
     keeps the original, kept-count toast fires, finding clears on the next debounced pass.
  3. **The popup:** the existing downscale-prompt tests — JPEG-only oversized set hides Optimize;
     mixed set's estimate counts JPEG at original bytes; post-run kept report fires when the
     stubbed encode returns originals.
- Guards must bite: reinstate-the-bug proof for the JPEG exemption (add JPEG to the predicate,
  watch the rule test fail) and for the stale-run drop (remove the guard, watch the harness test
  fail), per the test bar.
- The registry test that pairs every `fix` with a fixture must not start demanding one here — this
  rule deliberately has no pure fix; the suite asserts that explicitly rather than special-casing
  silently.

## Out of Scope

- Any lossy conversion offer in the Bench (Downscale stays a footer-only flow).
- JPEG findings in any form (silent exemption was the decision).
- SVG rasterization, and fixing the size-scan blind spot where SVGs are invisible to the oversize
  measurement (worker `createImageBitmap` can't decode SVG — noted for a future ticket).
- Re-encoding images inside character-card export/import or the community upload path.
- Any change to the encoder itself (grow-guard, quality constants, animated path).

## Further Notes

- Verified live during design (2026-08-18, app's own Chromium): worker-side `createImageBitmap`
  rejects SVG blobs outright; main-thread `Image()`+canvas rasterizes them fine — hence the SVG
  exemption and the named blind spot.
- The JPEG grow-guard mechanism is also why the Optimize popup seemed to contradict a completed
  community-download conversion: the run kept every JPEG whose lossless WebP grew, silently. This
  ticket makes that visible rather than changing it.
- Changelog: user-facing entry (👤) for the rule + fix; the popup honesty change rides in the same
  entry.
