import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Local editing draft for an item selected in an editor list — the pattern shared by the
 * stat/trait/entity/dictionary managers. Mirrors the item into local state (re-syncing when a
 * different item is selected), and applies edits by updating the draft and writing the result
 * through to the store in one step.
 *
 * `normalize` (optional) maps the incoming item into its draft shape — e.g. defaulting blank
 * fields. Pass a stable (module-level) function so the sync effect doesn't re-fire per render.
 */
export function useEditingDraft<T>(
  item: T,
  write: (next: T) => void,
  normalize?: (item: T) => T,
) {
  const [draft, setDraft] = useState<T>(() => (normalize ? normalize(item) : item));
  // The newest draft, so two writes in one event build on each other instead of the render's copy.
  const latest = useRef(draft);
  latest.current = draft;

  useEffect(() => {
    setDraft(normalize ? normalize(item) : item);
  }, [item, normalize]);

  /** Merge a patch into the draft and write the merged result through. */
  const apply = useCallback(
    (patch: Partial<T>) => {
      const next = { ...latest.current, ...patch };
      latest.current = next;
      setDraft(next);
      write(next);
    },
    [write],
  );

  /** Set one named field — the common editor-row case. */
  const setField = useCallback(
    (field: string, value: unknown) => apply({ [field]: value } as Partial<T>),
    [apply],
  );

  return { draft, setDraft, apply, setField };
}
