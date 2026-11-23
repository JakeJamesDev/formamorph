# 01: Server Picker By Approximation

Status: ready-for-human
Base: 66dc591
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Repo: FormamorphServer

The world path of supporter processing only; no route or client change.

## What to build

A Supporter world download marks the cover and the characters before any backdrop. With no picks yet (ticket 02 adds them), every character is chosen by the server's approximation (Q11). Existing Supporter worlds gain character marks with no client change.

- **Order.** The cover when markable (Q12). Then entities in the content's entity order, one image each, until the character budget is spent: 4, or 5 with no markable cover (Q15). Then the largest remaining eligible images for any budget left (Q10). Five marks in all (Q3).
- **Approximation.** An entity's first gallery slot without a Visibility rule. When that slot is a Layered Image, the first Variant without a rule on its base Layer: the first Layer that has a Variant, which sizes the canvas (Q2). Overlay Variants never count. Handle every gallery shape the content can hold: a `mediaId` link (an image entry or a layered entry), an embedded image, an embedded Layered Image, and the legacy single-portrait field.
- **Eligibility.** As today: at least 310k pixels, not animated, not SVG, decodable. An ineligible character image skips that character. An image already chosen counts once, and the next candidate takes the free mark.
- **One seam for ticket 02.** Build the per-entity choice so ticket 02 can put a checked pick in front of the approximation without reworking the order. Ticket 02 owns the pick check; this ticket owns the order and the approximation.
- **Cache.** Change the world processing version salt, so every cached world copy is retired.
- **Docs.** Mark R2 of the server's `large-supporter-worlds` spec as replaced by this effort, and correct its stale "Not deployed" Status note (the deploy log shows 2026-11-20). Update the supporter processing description in the server docs.

## Acceptance criteria

- [x] A world fixture with a cover, 5 characters and larger backdrops: the cover and the first 4 characters read back the account's mark with the watermark reader; no backdrop is marked. *Test "marks the cover and the first 4 characters…" in `tests/supporterWorldImages.test.js`.*
- [x] With no markable cover, 5 characters carry the mark. *"gives the free mark to a 5th character with %s": none, undecodable, missing `mediaId`, SVG, animated.*
- [x] With 2 usable characters, the 2 largest backdrops take the rest. *"spends the marks no character can use…", with a too-small character, ties, animated and SVG backdrops.*
- [x] A character whose slot 0 has a rule is marked through its first slot without one. *"marks a character through its first slot without a rule…".*
- [x] A Layered Image character is marked on its base Layer's first ruleless Variant; an overlay Variant larger than it stays unmarked. *"marks a Layered Image character…" and "never spends a spare mark on an overlay Variant…".*
- [x] An image shared by two characters is marked once, and the next character takes the free mark. *"marks an image two characters share once…".*
- [x] Embedded images, embedded Layered Images and the legacy portrait field each resolve. *"resolves embedded images, an embedded Layered Image and the legacy portrait field".*
- [x] Mascot tests pass unchanged, and the processing version changes. *`tests/supporterProcessing.test.js` untouched and green; "retires the cached copies…" checks the version against Base's `f5aaec31b413`.*
- [x] Each world assertion fails when the cover-plus-4-largest order is reinstated. *Base's `supporterProcessing.js` swapped in: all 17 new world tests red. Per-guard mutations (Variant rule, overlay skip, overlay exception, missing-entry slot, tree order, embedded base Layer) each turned their own test red.*

## Landed

Spec-session rulings used (2026-11-23): World Editor tree order; the backdrop fill skips overlay-only Variants; a slot that resolves to nothing is not a slot; every entity counts.

**Not verified**

- None. Every box above is ticked from a running test. Not run against production data or Sunmeadow itself.

**For you**

- Nothing for a player to judge here. The server's choice shows only in the watermark read-back.
