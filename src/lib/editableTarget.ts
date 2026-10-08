import { fieldUndoAt } from './fieldUndo';

/** Whether a key event's target takes typed text, so its own keys belong to it. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/** Input types whose text the browser can undo. */
const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

/**
 * Whether an undo or redo chord on this target belongs to the target: a prompt field that can take the move
 * itself, or a text box the world does not hold. A plain input bound to the world carries `data-world-field`.
 */
export function keepsOwnHistory(target: EventTarget | null, move: 'undo' | 'redo'): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const field = fieldUndoAt(target);
  if (field) return move === 'undo' ? field.canUndo() : field.canRedo();
  if (target.closest('[data-world-field]')) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return TEXT_INPUTS.has(target.type);
  return target.isContentEditable;
}
