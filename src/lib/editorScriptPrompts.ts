/**
 * The prompt host of one editor run, Test Code's or the Test Bench's (Q24). A confirm or a short ask waits in
 * the run's own store for the choice row; a prompt the dialog would show cancels until the dialog exists (Q49);
 * a tell or a toast lands in the run's notes.
 */

import {
  createScriptPromptStore, PromptCanceled, type ScriptPromptAnswer, type ScriptPromptHost, type ScriptPromptRequest,
  type ScriptPromptStore,
} from './scriptPrompts';

/** The most options an ask shows as choice rows (Q17). */
export const CHOICE_ROW_LIMIT = 4;

/** Whether a request shows as choice rows: a confirm, or a single ask of up to four options. */
export const fitsChoiceRow = (request: ScriptPromptRequest): boolean =>
  request.kind === 'confirm' || (request.kind === 'ask' && !request.multiple && request.options.length <= CHOICE_ROW_LIMIT);

/** One editor run's prompts. */
export interface EditorPromptRun {
  host: ScriptPromptHost;
  /** The choice-row prompts waiting for an answer. */
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
  const host: ScriptPromptHost = {
    prompt(request) {
      type Answer = ScriptPromptAnswer<typeof request.kind>;
      // Widened so the kind check narrows the request; the generic form does not narrow.
      const asked: ScriptPromptRequest = request;
      if (asked.kind === 'tell' || asked.kind === 'toast') {
        notes.push(`${asked.kind === 'tell' ? 'Tell' : 'Toast'}: ${asked.text}`);
        return Promise.resolve(undefined as Answer);
      }
      if (closed || !fitsChoiceRow(asked)) return Promise.reject(new PromptCanceled());
      return store.prompt(request);
    },
  };
  return {
    host, store, notes,
    close() {
      closed = true;
      store.pending().forEach(({ id }) => store.cancel(id));
      unsubscribe();
    },
  };
}
