# 07: Visibility in play

Status: done
Blocked by: 02, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a pure visibility helper plus a gallery index that keeps the player's place across a shrinking list, threaded through three surfaces that each build their own list today.

Parent: [Image Visibility Rules spec](../spec.md)

## What to build

The entity's shown image follows the story (Q4, Q7, Q10, Q12). A turn commits, Health drops under 20%, and the wounded portrait appears as the stat bar settles.

- A pure visibility helper takes the entity and the gate input (with the commit's stat snapshot) and returns the visible images in author order. An image with no rows is visible. An unresolved Condition hides its image.
- The primary in play is the first visible image. When every image hides, no image shows; if the entity has a 3D model, the model shows.
- The stored per-entity gallery index stays an author-order index. The hook maps it onto the visible list: the player's image is kept while visible; when it hides, the index moves to the primary. Paging steps through the visible list only.
- The visible list is passed into the entity visual as a prop. The panel, the zoom viewer and the persona row share it and never build their own.
- Outside play (library grid, listing art, setup) slot 0 shows, rules ignored (Q8).
- A loaded save shows the right image on its first settled frame.

## Acceptance criteria

- [ ] Helper: primary is first visible; all hidden yields none; unresolved hides; no-rows image always visible.
- [ ] Hook: paging keeps place when the current image stays visible; lands on the primary when it hides; wraps both ways over the visible list; the index outlives a shrink.
- [ ] Panel, zoom viewer and persona row render the same visible list (one test per surface over a gated gallery).
- [ ] All hidden with a model shows the model; all hidden without one shows the empty frame.
- [ ] Setup screen and library grid still show slot 0 with a rule on it.
- [ ] Changelog fragment written. Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
