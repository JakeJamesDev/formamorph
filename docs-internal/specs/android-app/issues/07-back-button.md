# 07 — Hardware back button

Status: ready-for-human
Type: task
Blocked by: 04
Spec: ../spec.md (Implementation Decisions › The back button)

## Task

- Pure function: given the app's view state (open modal, current view, view history), return `close-modal`, `go-back`, or `confirm-exit`.
- Thin hook subscribed to Capacitor's back event that applies the action. Confirm-exit reuses the existing confirm dialog and calls the app exit on yes.
- Mount the hook only when the Android bridge exists.

## Acceptance

- Table test for the pure function across modal open, nested view, main menu.
- On the phone: back closes an open modal, returns from the game to the main menu, and asks before exiting from the main menu.
- Four gates green.

## Comments

**Implemented 2026-09-04.** Four gates green.

- Pure function: `resolveBackAction` in [backAction.ts](src/lib/backAction.ts), with `recordView` for the trail App keeps. Table test in [backAction.test.ts](src/lib/backAction.test.ts).
- Hook: [useHardwareBack.ts](src/hooks/useHardwareBack.ts), on `@capacitor/app`'s `backButton` event. Mounted by [AndroidBackHandler.tsx](src/components/AndroidBackHandler.tsx), which owns the exit prompt and reuses `ConfirmDialog`. Gated on `Capacitor.isNativePlatform()` in [App.tsx](src/App.tsx), matching the export helper's precedent.
- `close-modal` dispatches Escape on the document. Radix answers on the highest layer only, so one press closes one layer and every existing modal gets back support with no edit of its own.
- Reachable without a phone: `#dev?modal=exitApp` raises the prompt.

### Beyond the ticket, and why

**Fixed: full-screen sub-screens.** The avatar editor and the first-run intro are neither a Radix layer nor a top-level view, so back over them resolved to `confirm-exit` — the app offered to close itself over unsaved avatar work. [useBackStop.ts](src/hooks/useBackStop.ts) lets such a screen claim the press; the pure function gained a `subScreens` count and still returns the ticket's three actions. Registered in [CharacterCustomization.tsx](src/views/CharacterCustomization.tsx) and [IntroSequence.tsx](src/components/IntroSequence.tsx) (the intro is deliberately not skippable, so it swallows the press).

**Fixed on request: back asks before leaving a game.** The ticket's acceptance said back returns to the main menu, but the in-game Exit asks first, so a stray press discarded the turn in hand. `AndroidBackHandler` takes a `confirmGoBack` prompt and App supplies it while the game view is on screen. The copy is now one exported constant, `EXIT_TO_MENU_PROMPT` in [MenuModal.tsx](src/components/modals/MenuModal.tsx), so both routes out ask the same thing. A sub-screen with its own guard still answers back before this does.

### Left open, for a product call

1. **Back is inert in the World Editor.** Its dialog blocks Escape on purpose so its guarded back arrow is the sole exit ([MainMenu.tsx](src/views/MainMenu.tsx)). Back behaves exactly as Escape does there, which reads as a dead button. Registering a back stop inside `WorldEditor` would fix it, but the mount is in `MainMenu.tsx`, held by ticket 05 while this landed.
2. **Changelog grouping.** Three Android entries now sit loose in the 👤 bucket. They want an **Android App:** header once the batch is complete; not done here to avoid rewriting ticket 05's in-flight entry.
