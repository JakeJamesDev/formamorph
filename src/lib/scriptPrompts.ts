/**
 * The pending-prompt store behind `player.*`: a script asks, the store holds the request until the UI answers
 * or the player closes it, and the executor reads the answer back. Kept free of QuickJS so the UI and the
 * editor can import it.
 */

import { randomUUID } from './uuid';

/** What one `player.*` call asks the host for. `ask` carries labels only; the picked values stay in the VM.
 *  `asker` is the asking script's display name, set by a host that runs many scripts (the Test Bench). */
export type ScriptPromptRequest =
  | { kind: 'tell'; text: string }
  | { kind: 'toast'; text: string }
  | { kind: 'confirm'; question: string; asker?: string }
  | { kind: 'ask'; question: string; options: readonly string[]; multiple: boolean; asker?: string }
  | { kind: 'input'; question: string; placeholder?: string; asker?: string };

export type ScriptPromptKind = ScriptPromptRequest['kind'];

/** A request that takes no answer from the player: a tell or a toast. */
export type ScriptNotice = Extract<ScriptPromptRequest, { kind: 'tell' | 'toast' }>;

export const isNotice = (request: ScriptPromptRequest): request is ScriptNotice =>
  request.kind === 'tell' || request.kind === 'toast';

/** What each kind's answer holds: `ask` answers with option indexes, one or a list with `multiple`. */
export interface ScriptPromptAnswers {
  tell: undefined;
  toast: undefined;
  confirm: boolean;
  ask: number | number[];
  input: string;
}

export type ScriptPromptAnswer<K extends ScriptPromptKind = ScriptPromptKind> = ScriptPromptAnswers[K];

/** One request waiting for the UI, first opened first. */
export interface PendingPrompt {
  id: string;
  request: ScriptPromptRequest;
}

/** Whoever answers a script's prompts: the store in play, a stub in a test. */
export interface ScriptPromptHost {
  /** Resolves with the answer, or rejects with a {@link PromptCanceled} when the player closes the prompt. */
  prompt<K extends ScriptPromptKind>(request: Extract<ScriptPromptRequest, { kind: K }>): Promise<ScriptPromptAnswer<K>>;
}

/** The rejection a closed prompt hands the script, which the executor reports as canceled (Q15). */
export class PromptCanceled extends Error {
  constructor() {
    super('The player closed the prompt');
    this.name = 'PromptCanceled';
  }
}

export const isPromptCanceled = (error: unknown): error is PromptCanceled => error instanceof PromptCanceled;

/** Whether `code` names `player.`, so it runs on the async engine (Q45). A stat named "player" matches too; the
 *  run is then slower, never wrong. */
export const namesPlayer = (code: string): boolean => /\bplayer\s*\./.test(code);

/** The store the UI subscribes to and answers. */
export interface ScriptPromptStore extends ScriptPromptHost {
  /** Every open prompt, oldest first. The same array until it changes, so a React store hook can compare it. */
  pending(): readonly PendingPrompt[];
  /** Hears every change to `pending()`. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Answer one prompt. Throws when the answer does not fit the request, and the prompt stays open. */
  answer(id: string, value: ScriptPromptAnswer): void;
  /** Close one prompt without an answer: its script fails as canceled. */
  cancel(id: string): void;
}

/** Whether `value` is an answer the request takes. */
function fits(request: ScriptPromptRequest, value: unknown): boolean {
  const index = (at: unknown) => typeof at === 'number' && Number.isInteger(at) && at >= 0
    && request.kind === 'ask' && at < request.options.length;
  switch (request.kind) {
    case 'tell':
    case 'toast':
      return value === undefined;
    case 'confirm':
      return typeof value === 'boolean';
    case 'input':
      return typeof value === 'string';
    case 'ask':
      return request.multiple ? Array.isArray(value) && value.every(index) : index(value);
  }
}

/**
 * A store of its own. With no listener, nothing can answer, so an ask, confirm or input cancels at once and a
 * tell or toast resolves with nothing shown (Q45).
 */
export function createScriptPromptStore(mintId: () => string = randomUUID): ScriptPromptStore {
  const listeners = new Set<() => void>();
  let open: readonly PendingPrompt[] = [];
  const settlers = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const notify = () => listeners.forEach((listener) => listener());
  const close = (id: string) => {
    const settle = settlers.get(id);
    if (!settle) return undefined;
    settlers.delete(id);
    open = open.filter((prompt) => prompt.id !== id);
    notify();
    return settle;
  };
  return {
    pending: () => open,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    prompt(request) {
      type Answer = ScriptPromptAnswer<typeof request.kind>;
      if (!listeners.size) {
        if (isNotice(request)) return Promise.resolve(undefined as Answer);
        return Promise.reject(new PromptCanceled());
      }
      const id = mintId();
      return new Promise<Answer>((resolve, reject) => {
        settlers.set(id, { resolve: (value) => resolve(value as Answer), reject });
        open = [...open, { id, request }];
        notify();
      });
    },
    answer(id, value) {
      const prompt = open.find((entry) => entry.id === id);
      if (!prompt) throw new Error(`No open prompt has the id ${id}`);
      if (!fits(prompt.request, value)) throw new TypeError(`The answer does not fit the ${prompt.request.kind} prompt`);
      close(id)?.resolve(value);
    },
    cancel(id) {
      close(id)?.reject(new PromptCanceled());
    },
  };
}

/** Close every open prompt of `store`: each script fails as canceled (Q15). */
export const cancelOpenPrompts = (store: ScriptPromptStore): void =>
  store.pending().forEach(({ id }) => store.cancel(id));

/** Where a host sends the requests that take no answer. */
export interface ScriptNoticeHandlers {
  onTell(text: string): void;
  onToast(text: string): void;
}

/** A host that hands each tell and toast to `handlers` at once, and every ask to `asks`. */
export function noticeHost(asks: ScriptPromptHost, handlers: ScriptNoticeHandlers): ScriptPromptHost {
  return {
    prompt(request) {
      // Widened so the kind check narrows the request; the generic form does not narrow.
      const asked: ScriptPromptRequest = request;
      if (!isNotice(asked)) return asks.prompt(request);
      if (asked.kind === 'tell') handlers.onTell(asked.text);
      else handlers.onToast(asked.text);
      return Promise.resolve(undefined as ScriptPromptAnswer<typeof request.kind>);
    },
  };
}

/** `host` with every ask, confirm and input stamped with `asker`; a tell or toast passes unchanged. */
export function askedBy(host: ScriptPromptHost, asker: string): ScriptPromptHost {
  return {
    prompt(request) {
      const asked: ScriptPromptRequest = request;
      return host.prompt(isNotice(asked) ? request : { ...request, asker });
    },
  };
}

/** The store the game's scripts prompt through and the UI answers. */
export const scriptPrompts: ScriptPromptStore = createScriptPromptStore();
