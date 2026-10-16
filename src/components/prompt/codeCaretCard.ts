/**
 * The cards a pointer hover can't open: one for the name at the caret, asked for by Ctrl+K Ctrl+I, and one
 * that follows a tap on touch. Both hang off a state field, so there is one card at a time per editor.
 */

import { StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state';
import {
  EditorView, closeHoverTooltips, keymap, showTooltip, ViewPlugin, type Tooltip, type TooltipView,
} from '@codemirror/view';
import type { CodeCard, CodeCardItem } from '@/lib/codeCards';
import type { CodeCardNavigation } from '@/lib/codeCardNavigation';
import type { CodeUse } from '@/lib/codeUses';
import { cardAnnouncement, renderCodeCard, renderCodeUses, type CodeCardActions } from '@/components/prompt/codeCardView';

/** How long a caret rests on a name after a tap before its card opens. */
export const CARET_PAUSE_MS = 500;

/** The caret lands a moment after the finger lifts; a selection later than this isn't the tap's. */
const TAP_WINDOW_MS = 400;

/** A screen reader skips text set to what the region already holds, so a repeat is cleared, then set. */
const ANNOUNCE_GAP_MS = 50;

interface CaretCard {
  card: CodeCard;
  /** True when the author asked from the keyboard, who needs the card read out. */
  announce: boolean;
  /** Set once Find All Uses pins the card: the list that hangs off it. */
  uses?: readonly CodeUse[];
}

const openCaretCard = StateEffect.define<CaretCard>();
const closeCaretCard = StateEffect.define<null>();

/** Moves the caret to `at` and closes the cards: a caret card closes on the move itself. */
export function goToDeclaration(view: EditorView, at: number): void {
  view.dispatch({ selection: { anchor: at }, scrollIntoView: true, effects: closeHoverTooltips });
  view.focus();
}

/** A pinned card's list and where its rows go. */
interface PinnedUses {
  uses: readonly CodeUse[];
  goToUse: (use: CodeUse) => void;
}

/** The tooltip view of a card. A dialog or full screen takes Escape on the document in the capture phase,
 *  so an open card takes it on the window first, closes through `dismiss` and stops it there. */
export function cardTooltipView(card: CodeCard, dismiss: () => void, actions: CodeCardActions = {}, pinned?: PinnedUses): TooltipView {
  const close = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    dismiss();
  };
  const { open } = actions;
  // Open and a use's row leave the code box, so the card closes first.
  const cardDom = renderCodeCard(card, { ...actions, open: open && ((item) => { dismiss(); open(item); }), guide: dismiss });
  if (!pinned) {
    return {
      dom: cardDom,
      mount: () => window.addEventListener('keydown', close, true),
      destroy: () => window.removeEventListener('keydown', close, true),
    };
  }
  // Pinned: the list hangs below, and a press anywhere else closes both.
  const usesDom = renderCodeUses(pinned.uses, (use) => { dismiss(); pinned.goToUse(use); });
  cardDom.classList.add('code-card-box');
  usesDom.classList.add('code-card-box');
  delete cardDom.dataset.codeCard;
  const dom = document.createElement('div');
  dom.className = 'flex flex-col gap-1';
  dom.dataset.codeCard = '';
  dom.dataset.codeCardPinned = '';
  dom.append(cardDom, usesDom);
  const pressOutside = (event: PointerEvent) => {
    if (!(event.target instanceof Node) || !dom.contains(event.target)) dismiss();
  };
  return {
    dom,
    mount: () => {
      window.addEventListener('keydown', close, true);
      window.addEventListener('pointerdown', pressOutside, true);
      // The link that pinned the card went with the card it was on.
      (usesDom.querySelector('button') ?? usesDom).focus({ preventScroll: true });
    },
    destroy: () => {
      window.removeEventListener('keydown', close, true);
      window.removeEventListener('pointerdown', pressOutside, true);
    },
  };
}

/** What a card's links reach, read when a card opens. */
export interface CardLinks {
  /** Absent where the host hides Open and Find All Uses. */
  navigation?: CodeCardNavigation;
  /** Every use of an item. Absent where the box has no world. */
  uses?: (item: CodeCardItem) => readonly CodeUse[];
}

export interface CaretCards {
  extension: Extension;
  /** The controls of `card` in `view`: Go to Line, Open, and Find All Uses, which pins it. */
  actions: (view: EditorView, card: CodeCard) => CodeCardActions;
  /** False while touch is the last input, where the caret pause owns the card and hover would open a second. */
  hoverAllowed: () => boolean;
  /** Closes a caret card on another name, and returns true when one is already open on `from` or pinned. */
  closeUnlessOpenAt: (view: EditorView, from: number) => boolean;
}

/** `cardAt` reads the card for a position against the editor's current world; null where nothing is named. */
export function createCaretCards(
  cardAt: (state: EditorState, pos: number) => CodeCard | null,
  links: () => CardLinks = () => ({}),
): CaretCards {
  let touching = false;
  let tapEndedAt = -Infinity;
  let pauseTimer: ReturnType<typeof setTimeout> | undefined;

  const field = StateField.define<CaretCard | null>({
    create: () => null,
    update(value, tr) {
      for (const effect of tr.effects) {
        if (effect.is(openCaretCard)) return effect.value;
        if (effect.is(closeCaretCard)) return null;
      }
      // Typing and moving the caret both leave the name the card was about.
      return tr.docChanged || tr.selection ? null : value;
    },
    provide: (self) => showTooltip.compute([self], (state): Tooltip | null => {
      const open = state.field(self);
      if (!open) return null;
      return {
        pos: open.card.from,
        end: open.card.to,
        above: false,
        create: (view) => {
          const goToUse = links().navigation?.goToUse;
          return cardTooltipView(
            open.card, () => view.dispatch({ effects: closeCaretCard.of(null) }), actions(view, open.card),
            open.uses && goToUse ? { uses: open.uses, goToUse } : undefined,
          );
        },
      };
    }),
  });

  /** One set of controls for hover and caret cards alike. */
  const actions = (view: EditorView, card: CodeCard): CodeCardActions => {
    const { navigation, uses } = links();
    return {
      goTo: (at) => goToDeclaration(view, at),
      open: navigation?.open,
      findUses: navigation && uses && ((item) => view.dispatch({
        effects: [closeHoverTooltips, openCaretCard.of({ card, announce: false, uses: uses(item) })],
      })),
    };
  };

  const clearPause = () => {
    if (pauseTimer !== undefined) { clearTimeout(pauseTimer); pauseTimer = undefined; }
  };

  /** Opens the card for the name at the caret, or at the start of a selected range. */
  const openAtCaret = (view: EditorView, announce: boolean): boolean => {
    const card = cardAt(view.state, view.state.selection.main.from);
    if (!card) return false;
    view.dispatch({ effects: [closeHoverTooltips, openCaretCard.of({ card, announce })] });
    return true;
  };

  const pauseThenOpen = (view: EditorView) => {
    clearPause();
    pauseTimer = setTimeout(() => {
      pauseTimer = undefined;
      tapEndedAt = -Infinity;
      openAtCaret(view, false);
    }, CARET_PAUSE_MS);
  };

  /** Reads the field and the pointer, so the live region and the touch pause follow the editor's own state. */
  const plugin = ViewPlugin.define((view) => {
    const live = document.createElement('div');
    live.className = 'sr-only';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    view.dom.appendChild(live);
    let announceTimer: ReturnType<typeof setTimeout> | undefined;
    const say = (text: string) => {
      if (announceTimer !== undefined) clearTimeout(announceTimer);
      live.textContent = '';
      if (!text) { announceTimer = undefined; return; }
      announceTimer = setTimeout(() => { announceTimer = undefined; live.textContent = text; }, ANNOUNCE_GAP_MS);
    };
    return {
      update(update) {
        const before = update.startState.field(field);
        const now = update.state.field(field);
        if (before !== now) say(now?.announce ? cardAnnouncement(now.card) : '');
        if (update.docChanged) clearPause();
        // The finger's own selection restarts the pause; any other move of the caret ends it.
        else if (update.selectionSet) {
          if (Date.now() - tapEndedAt <= TAP_WINDOW_MS) pauseThenOpen(update.view);
          else clearPause();
        }
      },
      destroy() { clearPause(); say(''); live.remove(); },
    };
  }, {
    eventHandlers: {
      pointerdown(event) {
        touching = event.pointerType === 'touch';
        if (touching) clearPause();
      },
      // A scroll or a drag ends in `pointercancel`, so only a finger that lifted in place is a tap. The caret
      // may not move when it lands where it already was, so the pause starts here too.
      pointerup(event, view) {
        if (event.pointerType !== 'touch') return;
        tapEndedAt = Date.now();
        pauseThenOpen(view);
      },
      pointermove(event) { touching = event.pointerType === 'touch'; },
      // The Escape listener is on the window, so a card left behind would swallow the next Escape from anywhere.
      blur(event, view) {
        clearPause();
        const to = event.relatedTarget;
        if (to instanceof Element && to.closest('[data-code-card]')) return;
        if (view.state.field(field)) view.dispatch({ effects: closeCaretCard.of(null) });
      },
    },
  });

  // Ctrl+I alone stays CodeMirror's select-syntax command; the chord is what leaves it free.
  const chord = keymap.of([{ key: 'Mod-k Mod-i', run: (view) => { openAtCaret(view, true); return true; } }]);

  return {
    extension: [field, plugin, chord],
    actions,
    hoverAllowed: () => !touching,
    closeUnlessOpenAt(view, from) {
      const open = view.state.field(field);
      if (!open) return false;
      // A pinned card stays while the pointer crosses other names.
      if (open.card.from === from || open.uses) return true;
      view.dispatch({ effects: closeCaretCard.of(null) });
      return false;
    },
  };
}
