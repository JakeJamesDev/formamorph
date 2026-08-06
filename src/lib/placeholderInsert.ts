/** Typing this in any placeholder-capable chip field opens the insert menu at the caret. */
export const PLACEHOLDER_TRIGGER = '{';

/** The hint an empty placeholder-capable field shows. With no toolbar on the field, this is what makes the
 *  typeahead discoverable; it stays away entirely when the world defines no placeholders to insert. */
export const placeholderHint = (base: string | undefined, enabled: boolean): string | undefined =>
  enabled ? `${base ?? ''}${base ? ' — ' : ''}${PLACEHOLDER_TRIGGER} inserts a placeholder` : base;
