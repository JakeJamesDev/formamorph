// Voice framings for the help baseline (ticket 16): each arm swaps the shipped framing of the Voice chip for one
// candidate, so framings compare inside one batch. The shipped framing is `frameVoice` in `helpChips.ts`. Neither
// candidate ships (Q46); the arms stay so a later framing can measure against them.
import { frameVoice } from '@/lib/formaquestion/helpChips';

export const VOICE_FRAMES = ['frame-a', 'frame-b'] as const;
export type VoiceFrame = (typeof VOICE_FRAMES)[number];

/** The shipped framing's first line, which names the Voice. */
const SPEAK = (voice: string) => frameVoice(voice).split('\n')[0];

/**
 * Each candidate framing:
 * - `frame-a`: the shipped lines and a line that puts the Not in Guide marker first
 * - `frame-b`: one line that orders the answer or the marker first, then the guide's names
 */
const FRAMES: Record<VoiceFrame, (voice: string) => string> = {
  'frame-a': (voice) => [
    frameVoice(voice),
    'When the guide sections do not cover the question, the Not in Guide marker still comes first, alone on its own line, and the voice starts on the next line.',
  ].join('\n'),
  'frame-b': (voice) => [
    SPEAK(voice),
    'Keep that voice. Begin with the answer, or with the Not in Guide marker alone on its own line when the guide sections do not cover the question. Write each step and control name as the guide writes it.',
  ].join('\n'),
};

/** The system prompt with the shipped framing of `voice` swapped for the `frame` candidate. A prompt with no Voice stays as it is. */
export function reframeVoice(frame: VoiceFrame, system: string, voice: string): string {
  if (!system.includes(SPEAK(voice))) return system;
  const shipped = frameVoice(voice);
  if (!system.includes(shipped)) throw new Error(`${frame}: the prompt has the Voice without the shipped framing`);
  return system.replace(shipped, FRAMES[frame](voice));
}

/**
 * A fetch that sends each system prompt through `reframeVoice`. It ends the probe when the swap cannot apply: the
 * harness would log a thrown error as one failed row and run on.
 */
export function voiceFrame(fetchImpl: typeof fetch, frame: VoiceFrame, voice: string): typeof fetch {
  return ((url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { messages: { role: string; content: unknown }[] };
    try {
      body.messages[0] = { ...body.messages[0], content: reframeVoice(frame, String(body.messages[0]?.content), voice) };
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    return fetchImpl(url, { ...init, body: JSON.stringify(body) });
  }) as typeof fetch;
}
