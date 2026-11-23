# 01: Server Picker By Approximation

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Repo: FormamorphServer. The world path of supporter processing only; no route or client change.

## What to build

A Supporter world download marks the cover and the characters before any backdrop. With no picks yet (ticket 02 adds them), every character is chosen by the server's approximation (Q11). Existing Supporter worlds gain character marks with no client change.

- **Order.** The cover when markable (Q12). Then entities in the content's entity order, one image each, until the character budget is spent: 4, or 5 with no markable cover (Q15). Then the largest remaining eligible images for any budget left (Q10). Five marks in all (Q3).
- **Approximation.** An entity's first gallery slot without a Visibility rule. When that slot is a Layered Image, the first Variant without a rule on its base Layer: the first Layer that has a Variant, which sizes the canvas (Q2). Overlay Variants never count. Handle every gallery shape the content can hold: a `mediaId` link (an image entry or a layered entry), an embedded image, an embedded Layered Image, and the legacy single-portrait field.
- **Eligibility.** As today: at least 310k pixels, not animated, not SVG, decodable. An ineligible character image skips that character. An image already chosen counts once, and the next candidate takes the free mark.
- **One seam for ticket 02.** Build the per-entity choice so ticket 02 can put a checked pick in front of the approximation without reworking the order. Ticket 02 owns the pick check; this ticket owns the order and the approximation.
- **Cache.** Change the world processing version salt, so every cached world copy is retired.
- **Docs.** Mark R2 of the server's `large-supporter-worlds` spec as replaced by this effort, and correct its stale "Not deployed" Status note (the deploy log shows 2026-11-20). Update the supporter processing description in the server docs.

## Acceptance criteria

- [ ] A world fixture with a cover, 5 characters and larger backdrops: the cover and the first 4 characters read back the account's mark with the watermark reader; no backdrop is marked.
- [ ] With no markable cover, 5 characters carry the mark.
- [ ] With 2 usable characters, the 2 largest backdrops take the rest.
- [ ] A character whose slot 0 has a rule is marked through its first slot without one.
- [ ] A Layered Image character is marked on its base Layer's first ruleless Variant; an overlay Variant larger than it stays unmarked.
- [ ] An image shared by two characters is marked once, and the next character takes the free mark.
- [ ] Embedded images, embedded Layered Images and the legacy portrait field each resolve.
- [ ] Mascot tests pass unchanged, and the processing version changes.
- [ ] Each world assertion fails when the cover-plus-4-largest order is reinstated.
