import { createContext, useContext, useMemo, useRef } from 'react';
import type { RenameRoot } from '@/lib/statCodeRename';

/**
 * Asking the rename offer, from a name field or from find-and-replace.
 *
 * Stat code reaches a stat, a placeholder, or a trait by name, so a new name strands every lookup that
 * spelled the old one. The editor cannot rewrite them on its own — an author may well have meant the lookup
 * to move elsewhere — so it asks, once, when the author commits the new name. `CodeRenameProvider` answers.
 */

/** What a name field asks the offer, once its edit is committed. */
export interface CodeRenameRequest {
  root: RenameRoot;
  /** The name as code read it before the edit. For a stat this is its code name. */
  oldName: string;
  newName: string;
  /** The names the other entries of this kind carry, so a rename onto one of them stays silent. */
  otherNames: readonly string[];
}

export type OfferCodeRename = (request: CodeRenameRequest) => void;

const noOffer: OfferCodeRename = () => {};

export const CodeRenameContext = createContext<OfferCodeRename | null>(null);

/** Ask the offer about a committed rename. A host with no provider above it asks nothing. */
export function useCodeRenameOffer(): OfferCodeRename {
  return useContext(CodeRenameContext) ?? noOffer;
}

/** The handlers a name field wires to report its own commits. */
export interface RenameFieldHandlers {
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: () => void;
}

/**
 * Watch one name field for a committed rename.
 *
 * The value at focus is the baseline, so typing through a dozen intermediate names produces one offer, for
 * the name the author settled on. Taking the baseline on focus rather than on the last commit also keeps an
 * edit made elsewhere — a find-and-replace, a discard — from reading as this field's own rename later.
 */
export function useRenameField({ root, value, siblings, ownId, codeNameOf }: {
  root: RenameRoot;
  /** The field's current text. */
  value: string;
  /** Every entry of this kind in the world, this one included. */
  siblings: readonly { id: string; name: string }[];
  /** Which of `siblings` this field edits, so its own name is not read as a duplicate. */
  ownId: string;
  /** The name as code reads it, where that differs from the field's text. Stats pass their code name. */
  codeNameOf?: (value: string) => string;
}): RenameFieldHandlers {
  const offer = useCodeRenameOffer();
  const otherNames = useMemo(
    () => siblings.filter((entry) => entry.id !== ownId).map((entry) => entry.name),
    [siblings, ownId],
  );
  const latest = useRef({ value, otherNames, codeNameOf });
  latest.current = { value, otherNames, codeNameOf };
  const baseline = useRef<string | null>(null);

  return useMemo(() => {
    // `stillFocused` is what separates Enter from blur: Enter leaves the caret in the field, so the name it
    // just committed becomes the baseline for whatever the author types next.
    const commit = (stillFocused: boolean) => {
      const started = baseline.current;
      const { value: now, otherNames: taken, codeNameOf: name } = latest.current;
      baseline.current = stillFocused ? now : null;
      if (started === null || started === now) return;
      const read = name ?? ((text: string) => text);
      offer({ root, oldName: read(started), newName: read(now), otherNames: taken.map(read) });
    };
    return {
      onFocus: () => { baseline.current = latest.current.value; },
      onBlur: () => commit(false),
      onSubmit: () => commit(true),
    };
  }, [offer, root]);
}
