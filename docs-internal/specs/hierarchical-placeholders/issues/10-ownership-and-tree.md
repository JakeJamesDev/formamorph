# 10 — Ownership and the placeholder tree

Status: done
Blocked by: 09

Spec: `../ownership-spec.md` (Ownership, Vocabulary).

## Scope

- A placeholder carries an owner reference: present ⇒ owned, absent ⇒ top level. Organizational only — the
  resolver never reads it, and the chip value stays what resolves.
- A new **pure** tree module, mirroring the location tree: rows, collapse, drop projection, drop application
  (including the owned-versus-shared decision), the delete cascade, and release-on-value-removal. The tree
  component is an adapter over the shared drag-tree scaffold with no logic of its own.
- Gestures: `{` in a value field inserts a shared row; a drag under a parent makes it owned, or a shared row
  when the target has other holders or world-text placements, with the row's icon as the only signal; inline
  create from a value field mints it owned and the create row names the owner; a row menu action promotes an
  owned placeholder to the top level.
- Owned placeholders are hidden from the palette and from the root of the `{` menu, reachable by drilling.
  The drill picker refuses to place a chip at something another placeholder owns and offers to promote it.
- The list becomes the tree. The hide-referenced-parts filter goes; "used by N" stays on top-level rows.
- Deleting a placeholder deletes what it owns behind a confirmation naming them. Deleting a shared original
  leaves its rows dangling — the existing red-`?` and dangling rule, never a cascade.
- A shared row carries an icon in the lead slot; clicking it opens the original.
- Names render bare in the tree and qualified with `›` everywhere the placeholder appears away from its
  owner. "Part" is retired from UI copy, drill picker headings included.
- Migration: every existing lone-chip value reads as a shared row. Nothing is auto-owned.

## Done

- Tests: the pure module carries the drop decision, the cascade and the release rule, driven as data with no
  dnd-kit; the picker refuses a foreign owned target; the palette and root menu hide owned rows. The list's
  used-by coverage moves into the pure module. Mutation-proven where guarding.
- Export-shape reminder in the response — the owner reference is new.
- Live-verified via dev-router against `saltmarsh-reach.json`, both themes if colors touched; four gates
  green; changelog entry appended.
