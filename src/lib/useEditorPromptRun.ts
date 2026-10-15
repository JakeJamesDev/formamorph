import { useCallback, useEffect, useRef, useState } from 'react';
import { editorPromptRun, type EditorPromptRun } from './editorScriptPrompts';
import type { ScriptPromptStore } from './scriptPrompts';

/** One editor surface's running prompts: at most one run at a time, closed at unmount. */
export interface EditorPromptRunHandle {
  /** The running run's open prompts; null while none runs. */
  store: ScriptPromptStore | null;
  /** Close any running run and start a new one. */
  open(): EditorPromptRun;
  /** Close the running run: an open prompt fails its script as canceled. */
  close(): void;
  /** Whether `run` is still the running one, so its result is not stale. */
  isCurrent(run: EditorPromptRun): boolean;
}

export function useEditorPromptRun(): EditorPromptRunHandle {
  const current = useRef<EditorPromptRun | null>(null);
  const [store, setStore] = useState<ScriptPromptStore | null>(null);
  const close = useCallback(() => {
    current.current?.close();
    current.current = null;
    setStore(null);
  }, []);
  useEffect(() => close, [close]);
  const open = useCallback(() => {
    close();
    const run = editorPromptRun();
    current.current = run;
    setStore(run.store);
    return run;
  }, [close]);
  const isCurrent = useCallback((run: EditorPromptRun) => current.current === run, []);
  return { store, open, close, isCurrent };
}
