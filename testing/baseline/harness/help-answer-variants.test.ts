import { describe, expect, it, vi } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { HELP_PICK_SYSTEM_PROMPT } from '@/lib/formaquestion/helpPrompt';
import { HELP_SYSTEM_PROMPT, helpSystemPrompt, helpUserMessage } from '@/lib/formaquestion/helpPrompt';
import { VOICED_HELP_PROMPT } from '@/test/helpFixtures';
import { answerVariant, rewriteAnswer, type AnswerVariant } from './help-answer-variants';

const index = bundledDocsIndex();
const sections = index.get(['Formaquestion#how-to-move-the-help-tab', 'Formaquestion#how-to-move-and-resize-the-window', 'Formaquestion#the-window']);
const QUESTION = 'can I drag it aside?';
const plain = helpUserMessage(QUESTION, sections);
const onScreen = helpUserMessage(QUESTION, sections, 'the Formaquestion window');
/** The headings of the sections in the guide block, in the order they are sent. */
const order = (user: string) => [...user.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
const HEADINGS = ['How to Move the Help Tab', 'How to Move and Resize the Window', 'The Window'];

describe('the answer variants', () => {
  it('v-goal adds the match rule to the system prompt after the line that takes facts from the guide', () => {
    const { system, user } = rewriteAnswer('v-goal', HELP_SYSTEM_PROMPT, plain);
    expect(user).toBe(plain);
    expect(system).toContain('guide sections.\n- Answer from the guide section whose heading names what the player asks about.\n- When the player asks');
  });

  it('v-close replaces the closing line of the user message and nothing else', () => {
    const { system, user } = rewriteAnswer('v-close', HELP_SYSTEM_PROMPT, plain);
    expect(system).toBe(HELP_SYSTEM_PROMPT);
    expect(user.endsWith('Answer the question from the guide section whose heading names what the player asks about.')).toBe(true);
    expect(user.replace(/[^\n]*$/, '')).toBe(plain.replace(/[^\n]*$/, ''));
  });

  it('v-labels lists the headings of the sent sections after the guide, in block order', () => {
    const { user } = rewriteAnswer('v-labels', HELP_SYSTEM_PROMPT, onScreen);
    expect(user).toContain(`</guide>\n\nThe guide sections: ${HEADINGS.join('; ')}.\n\nThe player asks from this screen`);
    expect(order(user)).toEqual(HEADINGS);
  });

  it('v-order sends the sections in reverse, so the top hit sits next to the question', () => {
    expect(order(rewriteAnswer('v-order', HELP_SYSTEM_PROMPT, plain).user)).toEqual([...HEADINGS].reverse());
  });

  it('v-order keeps the open screen\'s section first, as the screen line says', () => {
    expect(order(rewriteAnswer('v-order', HELP_SYSTEM_PROMPT, onScreen).user)).toEqual([HEADINGS[0], HEADINGS[2], HEADINGS[1]]);
  });

  it('v-labels and v-order leave a message with no section as it is', () => {
    const bare = helpUserMessage(QUESTION, []);
    expect(rewriteAnswer('v-labels', HELP_SYSTEM_PROMPT, bare).user).toBe(bare);
    expect(rewriteAnswer('v-order', HELP_SYSTEM_PROMPT, bare).user).toBe(bare);
  });

  it('stops when the prompt no longer holds the line a variant rewrites', () => {
    expect(() => rewriteAnswer('v-goal', 'Another prompt.', plain)).toThrow(/v-goal/);
    expect(() => rewriteAnswer('v-close', HELP_SYSTEM_PROMPT, `${plain}\nMore.`)).toThrow(/v-close/);
  });
});

describe('the answer variant fetch', () => {
  const sent = (system: string, user = plain, variant: AnswerVariant = 'v-labels') => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(''));
    const body = JSON.stringify({ messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
    void answerVariant(fetchImpl, variant)('https://help.example.com', { body });
    return JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)) as { messages: { content: string }[] };
  };

  it('rewrites the answer request, with the language directive on its prompt too', () => {
    expect(sent(helpSystemPrompt('Spanish')).messages[1].content).toContain('The guide sections: ');
  });

  it('rewrites the answer request that carries the Voice', () => {
    expect(sent(VOICED_HELP_PROMPT).messages[1].content).toContain('The guide sections: ');
  });

  it('sends every other request as it is', () => {
    expect(sent(HELP_PICK_SYSTEM_PROMPT).messages[1].content).toBe(plain);
  });

  it('ends the probe when a rewrite cannot apply, so no arm runs on as the control', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as typeof process.exit);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => sent(HELP_SYSTEM_PROMPT, `${plain}\nMore.`, 'v-close')).toThrow('exit');
    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/v-close/));
    exit.mockRestore();
    error.mockRestore();
  });
});
