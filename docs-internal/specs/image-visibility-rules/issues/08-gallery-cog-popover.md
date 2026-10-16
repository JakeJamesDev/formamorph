# 08: Cog, badge and summary on the gallery

Status: done
Blocked by: 04, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: UI over two finished seams. A hover control, a popover inside a dialog, a badge and a sentence. Design-system and copy rules apply.

Parent: [Image Visibility Rules spec](../spec.md)

## What to build

An author sets a Visibility rule from the gallery (Q6, Q8, Q14, Q17).

- Each thumbnail shows a cog on hover. The cog opens a popover that mounts the lifted rows editor with the image's own entity as default bearer (stored as absent). The popover sits inside the entity editor dialog, so it uses the modal popover mode.
- A badge marks a thumbnail that carries a rule.
- The summary sentence under the selected thumbnail reads "Shown while …" through the rule text helpers. An image with no rule shows no sentence.
- Slot 0 with a rule shows an inline warning under the thumbnail: the cover shows everywhere outside play. Not a blocker.
- Show-when only; no direction toggle.
- Copy follows the Writing Guide. The term is **Visibility rule**; the trait side keeps **Availability rule**. The cog's tooltip labels its child.

## Acceptance criteria

- [ ] The cog opens the rows editor; a rule set there is stored on that image and survives reorder.
- [ ] The badge appears on a conditioned thumbnail and not on a plain one.
- [ ] The summary reads a stat and a trait Condition with the "Shown while" lead; Not reads correctly.
- [ ] The slot 0 warning shows only when slot 0 carries a rule.
- [ ] The popover scrolls inside the dialog without closing it (modal popover).
- [ ] Dev route for the entity editor gallery shows the cog, badge and warning in both themes (static frames).
- [ ] Changelog fragment written. Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
