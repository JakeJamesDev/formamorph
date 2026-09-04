# 01 — Build the Track-Changes diff view in the Custom Prompts dialog

Status: ready-for-agent

Implement the winning variant (B — Track Changes) from `../spec.md` as a production component,
replacing the prototype.

## Tasks

1. Capture the prototype: commit `src/components/game/PromptDiffPrototype.tsx` + its MainMenu wiring
   to a throwaway branch `prototype/prompt-diff`; remove both from main.
2. New component (e.g. `src/components/game/PromptDiff.tsx`): word-level diff of world prompt vs
   `GamePrompts.ts` default for a given `WorldPromptKind`, chip-atomic per the spec's sentinel
   technique, rendered as inline `<ins>`/`<del>` spans in the dialog's existing `pre` styling.
3. Wire into the Custom Prompts dialog in `MainMenu.tsx`: Changes/Raw toggle (Changes default,
   session-local), legend line, per-pass tabs unchanged.
4. Keep the `worldPrompts` dev-modal working via a DEV-only canned sample override (canned-sample
   pattern from `devRoutes.ts`); prod builds must tree-shake it.
5. Tests: diff helpers (chip atomicity both-sides mapping, sentinel restore round-trip) —
   mutation-proven per the test bar. `devRouter.test.ts` guard stays green.
6. Changelog: In-Progress 👤 Added entry.

## Done bar

- Four gates green (`typecheck` / `lint` / `test` / `build`), `graphify update .` run.
- UI verified live via `#dev?view=mainMenu&modal=worldPrompts` in both themes, real viewport.
- No export-shape change; no new `any`; prototype gone from main.
