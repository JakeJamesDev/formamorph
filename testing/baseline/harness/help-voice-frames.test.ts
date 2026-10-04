import { afterEach, describe, expect, it, vi } from 'vitest';
import { frameVoice, renderHelpPrompt } from '@/lib/formaquestion/helpChips';
import { DEFAULT_HELP_PROMPTS, HELP_SYSTEM_PROMPT } from '@/lib/formaquestion/helpPrompt';
import { reframeVoice, voiceFrame } from './help-voice-frames';

const VOICE = 'Be warm.';
const voiced = renderHelpPrompt(DEFAULT_HELP_PROMPTS.answer, { voice: VOICE });
/** The paragraph the Voice chip sends, as the arm leaves it: the one after the intro line. */
const voiceParagraph = (system: string) => system.split('\n\n')[1];
/** The prompt without the Voice paragraph. */
const withoutVoice = (system: string) => system.split('\n\n').filter((_, i) => i !== 1);

describe('the Voice frame arms', () => {
  it('frame-a adds the marker line after the shipped lines, and leaves the rest of the prompt as it is', () => {
    const system = reframeVoice('frame-a', voiced, VOICE);
    const lines = voiceParagraph(system).split('\n');
    expect(lines.slice(0, 2).join('\n')).toBe(frameVoice(VOICE));
    expect(lines[2]).toMatch(/^When the guide sections do not cover the question, the Not in Guide marker still comes first/);
    expect(withoutVoice(system)).toEqual(withoutVoice(voiced));
  });

  it('frame-b sends one ordering line in place of the shipped second line', () => {
    const system = reframeVoice('frame-b', voiced, VOICE);
    expect(voiceParagraph(system)).toBe('Speak in this voice: Be warm.\nKeep that voice. Begin with the answer, or with the Not in Guide marker alone on its own line when the guide sections do not cover the question. Write each step and control name as the guide writes it.');
    expect(withoutVoice(system)).toEqual(withoutVoice(voiced));
  });

  it('leaves a prompt with no Voice as it is', () => {
    expect(reframeVoice('frame-a', HELP_SYSTEM_PROMPT, VOICE)).toBe(HELP_SYSTEM_PROMPT);
  });

  it('stops when the Voice is there without the shipped framing', () => {
    expect(() => reframeVoice('frame-a', `${HELP_SYSTEM_PROMPT}\n\nSpeak in this voice: ${VOICE}`, VOICE)).toThrow(/frame-a/);
  });
});

describe('the Voice frame fetch', () => {
  const sent = (system: string) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(''));
    const body = JSON.stringify({ messages: [{ role: 'system', content: system }, { role: 'user', content: 'How do I add a trait?' }] });
    void voiceFrame(fetchImpl, 'frame-b', VOICE)('https://help.example.com', { body });
    return JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)) as { messages: { content: string }[] };
  };

  afterEach(() => vi.restoreAllMocks());

  it('sends the system prompt with the candidate framing', () => {
    expect(sent(voiced).messages[0].content).toBe(reframeVoice('frame-b', voiced, VOICE));
  });

  it('ends the probe when the swap cannot apply, so no arm runs on as the shipped framing', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as typeof process.exit);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => sent(`${HELP_SYSTEM_PROMPT}\n\nSpeak in this voice: ${VOICE}`)).toThrow('exit');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
