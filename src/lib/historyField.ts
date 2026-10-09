/**
 * The World Editor's field identity: a stable name on each field's frame, so a history Step can record the
 * field in use and a reveal can find it again after the text changed. The frame is the element the Landing
 * Pulse rings. Names follow the record's data path: `name`, or `descriptors/<row id>/text` for a row field.
 */

/** The attribute a field's frame carries. Its value is the field identity. */
export const HISTORY_FIELD_ATTRIBUTE = 'data-history-field';

/** The attribute a field's frame spreads. */
export type HistoryFieldAttribute = Readonly<Record<typeof HISTORY_FIELD_ATTRIBUTE, string>>;

/** A field identity, joined from its data path parts. */
export function fieldPath(...parts: string[]): string {
  return parts.join('/');
}

/** The attribute for a field's frame. */
export function fieldFrame(...parts: string[]): HistoryFieldAttribute {
  return { [HISTORY_FIELD_ATTRIBUTE]: fieldPath(...parts) };
}

/** The identity of the field that holds a node, if any. */
export function fieldOf(node: EventTarget | null): string | undefined {
  if (!(node instanceof Element)) return undefined;
  return node.closest(`[${HISTORY_FIELD_ATTRIBUTE}]`)?.getAttribute(HISTORY_FIELD_ATTRIBUTE) ?? undefined;
}

/** The frame of a field. Of several, the one on screen wins: a layout can draw a field twice and hide one. */
export function findHistoryField(root: ParentNode, field: string): HTMLElement | null {
  const frames = Array.from(root.querySelectorAll<HTMLElement>(`[${HISTORY_FIELD_ATTRIBUTE}]`))
    .filter((frame) => frame.getAttribute(HISTORY_FIELD_ATTRIBUTE) === field);
  return frames.find((frame) => frame.getClientRects().length > 0) ?? frames[0] ?? null;
}

/**
 * Reports the field in use each time it changes: the field focus moves into, or none. A write the old field
 * commits on blur is queued in the same events, so a host that keeps the field as React state commits both
 * in one render. Returns a stop.
 */
export function watchFieldInUse(doc: Document, onChange: (field: string | undefined) => void): () => void {
  let field: string | undefined;
  const report = (next: string | undefined) => {
    if (next === field) return;
    field = next;
    onChange(next);
  };
  const onFocusIn = (event: FocusEvent) => report(fieldOf(event.target));
  // Focus moving to another element reports through that element's focusin.
  const onFocusOut = (event: FocusEvent) => { if (!event.relatedTarget) report(undefined); };
  doc.addEventListener('focusin', onFocusIn);
  doc.addEventListener('focusout', onFocusOut);
  return () => {
    doc.removeEventListener('focusin', onFocusIn);
    doc.removeEventListener('focusout', onFocusOut);
  };
}
