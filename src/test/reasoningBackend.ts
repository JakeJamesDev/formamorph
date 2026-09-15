/**
 * The fake backend every reasoning-capability test builds on.
 *
 * One builder rather than one per file: each resolver suite needs the same thing — a fetch that answers
 * only the URLs its case names and 404s the rest, the way a real server does, plus the record of what was
 * asked. A source added to the chain means one edit here instead of a sweep through every suite.
 */

/** One canned answer. The body defaults to an empty object, which is what a bare 404 sends. */
export interface BackendAnswer {
  status: number;
  body?: unknown;
}

/** One request the resolver made. */
export interface BackendCall {
  url: string;
  method: string;
}

/** The endpoint-and-model pair the resolver suites run against, so a case differs only in what answers. */
export const REASONING_TARGET = { url: 'http://host.example/v1/chat/completions', token: 't', model: 'm' };

/** The advertisement URLs the chain derives from that target, named so a case reads as the source it means. */
export const LM_STUDIO_URL = 'http://host.example/api/v1/models';
export const OLLAMA_URL = 'http://host.example/api/show';
export const PROPS_URL = 'http://host.example/props';
export const OPENAI_URL = 'http://host.example/v1/models';
export const COMPLETIONS_URL = REASONING_TARGET.url;

/** A fetch that answers only the URLs `answers` names; everything else 404s, as a real backend would. */
export function reasoningBackend(answers: Record<string, BackendAnswer>) {
  const calls: BackendCall[] = [];
  const doFetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET' });
    const answer = answers[url] ?? { status: 404, body: {} };
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      json: async () => answer.body ?? {},
      text: async () => JSON.stringify(answer.body ?? {}),
      // Only the four members the resolver reads; the rest of Response never comes into it.
    } as Response;
  };
  return { doFetch, calls };
}

/** How many completions a resolve sent — the number the single-probe guard caps at one. */
export const probeCount = (calls: readonly BackendCall[]): number =>
  calls.filter((c) => c.url === COMPLETIONS_URL).length;
