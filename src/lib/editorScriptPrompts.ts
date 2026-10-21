/**
 * The prompt host of one editor run, Test Code's or the Test Bench's (Q24). A confirm, an ask or an input waits
 * in the run's own store for the inline prompt line (Q49, Q53); a tell or a toast lands in the run's notes (Q54).
 */

import {
  cancelOpenPrompts, createScriptPromptStore, noticeHost, PromptCanceled, type ScriptPromptHost, type ScriptPromptStore,
} from './scriptPrompts';

/** One editor run's prompts. */
export interface EditorPromptRun {
  host: ScriptPromptHost;
  /** The prompts waiting for an answer on the line. */
  store: ScriptPromptStore;
  /** Each tell and toast, in call order, as one line each. */
  notes: string[];
  /** Cancel every open prompt and every later one. */
  close(): void;
}

export function editorPromptRun(): EditorPromptRun {
  const store = createScriptPromptStore();
  // The run answers its own prompts, so the store never cancels for want of a listener.
  const unsubscribe = store.subscribe(() => {});
  const notes: string[] = [];
  let closed = false;
  const asks: ScriptPromptHost = {
    prompt: (request) => (closed ? Promise.reject(new PromptCanceled()) : store.prompt(request)),
  };
  const host = noticeHost(asks, {
    onTell: (text) => { notes.push(`Tell: ${text}`); },
    onToast: (text) => { notes.push(`Toast: ${text}`); },
  });
  return {
    host, store, notes,
    close() {
      closed = true;
      cancelOpenPrompts(store);
      unsubscribe();
    },
  };
}
