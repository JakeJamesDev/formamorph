# Custom Prompts Diff Viewer — Spec

Status: done

Worlds that ship custom prompts are hard to audit: the Custom Prompts warning popup shows the full
prompt text with no indication of what the author changed. Add a diff view so a player can see at a
glance what this world adds to — and removes from — the stock prompts.

## Verdict (prototype, 2026-08-24)

Four variants were prototyped live (`PromptDiffPrototype.tsx`, variants A–D). **B — Track Changes
won**: one flowing document, word-level diff, green insertions and red strikethrough deletions
inline. Rejected: A (unified code rows with gutter), C (clean text + separate removals ledger),
D (A's rows with B's inline strikethrough).

## Settled decisions (grilling, 2026-08-24)

| Decision | Call |
|---|---|
| Baseline | Shipped app defaults (`GamePrompts.ts`), per pass — not the player's active preset |
| Scope | The 3 `WorldPromptOverrides` kinds (narration / choices / statUpdates) only |
| Opening cue | Excluded — not an instruction pass, no player opt-out |
| Author-side editor | Excluded for now; component should be cleanly reusable later |
| Diff scope | Additions **and** removals |
| Granularity | Word-level (B has no line pairing) |
| Landing view | Diff first; toggle to the raw view |
| Chips | Raw `<TOKEN\|…>` text, each chip atomic in the diff (never split mid-highlight) |
| Total rewrites | No special-casing — honest diff; the raw toggle is the escape hatch |

## Behavior

- In the Custom Prompts dialog (`MainMenu.tsx`, opened via the world-details "View" notice), each
  pass tab renders the word diff of the world's stored prompt against that pass's shipped default.
- Toggle between Changes (default) and Raw. Session-local state, not persisted; reopening lands on
  Changes. Title-case labels.
- A one-line legend explains the coloring (green = added by this world, red struck = removed from
  the default).
- Insertions: green-tinted spans. Deletions: red strikethrough inline at the point of removal.
  Same monospace `pre` treatment as the current raw view; both themes.

## Implementation notes (validated in the prototype)

- Dependency: `diff@9` (jsdiff), already installed. `diffWordsWithSpace` is the diff primitive.
- Chip atomicity: swap each `<TOKEN|…>` chip (`/<[A-Z][^<>]*>/`) for a **single private-use-area
  codepoint** before diffing, restore per-segment at render. The same chip text must map to the
  same sentinel on both sides — per-side sentinels make identical chip lines diff as changed
  (bug found live).
- `diffWordsWithSpace` splits hyphenated words ("second-person" → "second" / "person"); accepted.
- Keep the `worldPrompts` dev-modal (`devRoutes.ts`) with a DEV-only canned sample override
  (defaults with authored edits), following the `publish`/`changelog` canned-sample pattern, so the
  dialog is verifiable on an empty library.

## Out of scope

- Any change to world/save export shape (display-only feature).
- Version bump, changelog finalization (append to In-Progress 👤 only).
- Diffing against the player's customized prompts.

## Prototype capture

Before folding in: commit the prototype (all four variants + switcher) to a throwaway branch
(`prototype/prompt-diff`), then remove it from main. The winning variant is **rewritten** to
production quality, not promoted as-is.
