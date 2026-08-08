import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EditorModeContext, readEditorMode, writeEditorMode, type EditorMode } from '@/lib/editorMode';

/** Wraps the World Editor. `forcedMode` overrides the stored preference (the dev-router's `mode` param) and
 *  re-applies whenever the route hands it over again, so a `goto` lands in that mode even after a click
 *  moved the switch. */
export function EditorModeProvider({ children, forcedMode, forcedNonce }: {
  children: ReactNode;
  forcedMode?: EditorMode;
  /** Bumped per dev-route change so re-navigating to the mode you are already in still re-applies. */
  forcedNonce?: number;
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
  const value = useMemo(() => ({ mode, advanced: mode === 'advanced', setMode }), [mode, setMode]);
  return <EditorModeContext.Provider value={value}>{children}</EditorModeContext.Provider>;
}
