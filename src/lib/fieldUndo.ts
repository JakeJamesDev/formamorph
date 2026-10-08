/**
 * What a text field with its own history can undo. A prompt field registers its editable root while it is
 * mounted, so the editor's chord listener can let the field take a press it can use.
 */
export interface FieldUndo {
  canUndo(): boolean;
  canRedo(): boolean;
}

const fields = new WeakMap<Element, FieldUndo>();

/** Registers a field's root. Returns the call that removes it. */
export function registerFieldUndo(root: Element, undo: FieldUndo): () => void {
  fields.set(root, undo);
  return () => { if (fields.get(root) === undo) fields.delete(root); };
}

/** The registered field holding an element, or null. */
export function fieldUndoAt(element: Element): FieldUndo | null {
  const root = element.closest('[data-lexical-editor="true"]');
  return (root && fields.get(root)) ?? null;
}
