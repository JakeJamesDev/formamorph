import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EditorModeContext, readEditorMode, writeEditorMode, type EditorMode } from '@/lib/editorMode';

/** Wraps the World Editor. `forcedMode` overrides the stored preference (the dev-router's `mode` param, or
 *  a surface request for a tab only Advanced shows) and re-applies whenever it is handed over again, so a
 *  `goto` or a request lands in that mode even after a click moved the switch. */
export function EditorModeProvider({ children, forcedMode, forcedNonce, lockedMode }: {
  children: ReactNode;
  forcedMode?: EditorMode;
  /** Bumped per dev-route change and per surface request, so asking again for the mode in force re-applies. */
  forcedNonce?: number;
  /** Shown in place of the author's mode while set. The author's mode is kept and returns when it clears. */
  lockedMode?: EditorMode;
}) {
  const [mode, setModeState] = useState<EditorMode>(() => forcedMode ?? readEditorMode());
  const setMode = useCallback((next: EditorMode) => {
    setModeState(next);
    writeEditorMode(next);
  }, []);
  const appliedNonce = useRef(forcedNonce);
  useEffect(() => {
    if (!forcedMode || forcedNonce === appliedNonce.current) return;
    appliedNonce.current = forcedNonce;
    setModeState(forcedMode);
  }, [forcedMode, forcedNonce]);
  const shown = lockedMode ?? mode;
  const value = useMemo(() => ({ mode: shown, advanced: shown === 'advanced', setMode }), [shown, setMode]);
  return <EditorModeContext.Provider value={value}>{children}</EditorModeContext.Provider>;
}
