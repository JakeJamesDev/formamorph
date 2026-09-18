# 05: Bubble Action Row and Rewind to Here

Status: ready-for-human
Base: 6f7bd1ec
Blocked by: 02
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/chat-layout/spec.md`

## What to build

Each committed narration bubble in Chat gets a row of icon actions at its bottom, with the turn number on
the left. One pure builder returns the action list for a bubble. The row renders that list, and ticket 06
renders the same list as a menu. Rollback becomes a per-bubble **Rewind to Here** action.

The action shape from the prototype:

```ts
interface BubbleAction { key: string; label: string; icon: ReactNode; section: 'generate' | 'content' | 'destructive'; disabled?: boolean; run: () => void }
```

## Acceptance criteria

- [ ] Latest turn: Re-generate Narration (refresh icon), Re-generate Stats (chart icon), Generate Scene Image (only with no image), Edit, Text to Speech, Copy Text.
- [ ] Past turn: the same without the two re-generate actions, plus Rewind to Here.
- [ ] Write Scene Tags and Regenerate Audio are in the list but do not show as row icons. A More icon on the row opens them. Ticket 06 replaces that popup with the full menu.
- [ ] Copy Text copies the turn's markdown source.
- [ ] Re-generate Narration pins the turn as a submit does.
- [ ] Rewind to Here opens the confirm dialog of today and rolls back to the index of its bubble, not to the viewed turn.
- [ ] A live turn has no actions. Actions that start a request are disabled while a reply streams.
- [ ] Each icon button has a tooltip, an accessible label, and Tab focus with the shared inset ring. Each turn exposes its turn number to a screen reader.
- [ ] In Chat, the top-right options control holds only the whole-story items, for example Export Story. Pages keeps its full control.
- [ ] Unit tests for the builder: latest against past, busy states, image present, Rewind to Here is the only destructive action. Harness tests: the handlers are called, and Rewind to Here confirms and then rolls back to the right index.
- [ ] Verified in the preview with static frames. Four gates green.

## Comments

- **Superseded labels (spec session ruling, 2026-09-18).** "Read Aloud" and "Re-generate TTS" were prototype labels. The
  bubble uses the Pages items and labels: **Text to Speech** (row icon, opens the TTS modal) and **Regenerate Audio**
  (More menu only, shown only with a voice model loaded). Regenerate Audio takes a turn's text, so every bubble offers it for its own narration.
- **Gap: Text to Speech on past bubbles (2026-09-18).** The TTS modal's Generate button reads the latest turn's text
  (`getGameplayText()` in `TTSModal.tsx`), so only the latest bubble offers Text to Speech, per the spec ruling. A past
  bubble gets it once the modal takes a text to speak. That change is not in ticket 05.
