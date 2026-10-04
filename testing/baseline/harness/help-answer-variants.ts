// Answer-prompt variants for the help baseline (ticket 51): each rewrites the help answer request and leaves
// every other request alone. None ships (Q83); the arms stay so a later prompt change can measure against them.
import { HELP_SYSTEM_PROMPT } from '@/lib/formaquestion/helpPrompt';

export const ANSWER_VARIANTS = ['v-goal', 'v-close', 'v-labels', 'v-order'] as const;
export type AnswerVariant = (typeof ANSWER_VARIANTS)[number];

/** The answer prompt's first line. The Voice and the language directive leave it in place. */
const ANSWER_INTRO = HELP_SYSTEM_PROMPT.split('\n')[0];
const TAKE_LINE = '- Take each fact, each step and each name from the guide sections.';
const CLOSE_LINE = 'Answer the question from the guide sections above.';
const MATCH_TARGET = 'from the guide section whose heading names what the player asks about.';
const LEAD_LINE = 'The first guide section explains it.';
const SECTION = /<section page="[^"]*">\n[\s\S]*?\n<\/section>/g;
const GUIDE_OPEN = '<guide>\n';
const GUIDE_CLOSE = '\n</guide>';

/**
 * One variant applied to the answer request's system prompt and last user message:
 * - `v-goal`: the match rule as a system prompt line, after the line that takes facts from the guide
 * - `v-close`: the match rule as the user message's closing line
 * - `v-labels`: the headings of the sent sections as one line after the guide
 * - `v-order`: the sections in reverse, so the top hit sits next to the question; the screen's lead stays first
 */
export function rewriteAnswer(variant: AnswerVariant, system: string, user: string): { system: string; user: string } {
  if (variant === 'v-goal') {
    if (!system.includes(TAKE_LINE)) throw new Error('v-goal: the help prompt has no line to follow');
    return { system: system.replace(TAKE_LINE, `${TAKE_LINE}\n- Answer ${MATCH_TARGET}`), user };
  }
  if (variant === 'v-close') {
    if (!user.endsWith(CLOSE_LINE)) throw new Error('v-close: the user message has no closing line to replace');
    return { system, user: `${user.slice(0, -CLOSE_LINE.length)}Answer the question ${MATCH_TARGET}` };
  }
  const end = user.indexOf(GUIDE_CLOSE);
  if (!user.startsWith(GUIDE_OPEN) || end < 0) return { system, user };
  const sections = user.slice(GUIDE_OPEN.length, end).match(SECTION) ?? [];
  if (sections.length === 0) return { system, user };
  if (variant === 'v-order') {
    const kept = user.includes(LEAD_LINE) ? sections.slice(0, 1) : [];
    const ordered = [...kept, ...sections.slice(kept.length).reverse()];
    return { system, user: `${GUIDE_OPEN}${ordered.join('\n\n')}${user.slice(end)}` };
  }
  const headings = sections.flatMap((section) => section.match(/^#+\s+(.+)$/m)?.[1]?.trim() ?? []);
  const after = end + GUIDE_CLOSE.length;
  return { system, user: `${user.slice(0, after)}\n\nThe guide sections: ${headings.join('; ')}.${user.slice(after)}` };
}

/**
 * A fetch that sends the help answer request through `rewriteAnswer`, and every other request as it is. It ends
 * the probe when a rewrite cannot apply: the harness would log a thrown error as one failed row and run on.
 */
export function answerVariant(fetchImpl: typeof fetch, variant: AnswerVariant): typeof fetch {
  return ((url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { messages: { role: string; content: unknown }[] };
    if (!String(body.messages[0]?.content).startsWith(ANSWER_INTRO)) return fetchImpl(url, init);
    try {
      const last = body.messages.at(-1);
      if (typeof last?.content !== 'string') throw new Error(`${variant}: the question is not plain text`);
      const next = rewriteAnswer(variant, String(body.messages[0].content), last.content);
      body.messages[0] = { ...body.messages[0], content: next.system };
      body.messages[body.messages.length - 1] = { ...last, content: next.user };
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    return fetchImpl(url, { ...init, body: JSON.stringify(body) });
  }) as typeof fetch;
}
