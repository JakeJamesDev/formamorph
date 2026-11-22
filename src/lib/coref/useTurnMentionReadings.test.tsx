import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { ChatMessage, Entity } from '@/types';
import type { CharacterMentions, PassageReading } from './characterMentions';
import { readingVersion } from './mentionReading';
import { narrationHash, type MentionReadingMap } from './mentionReadings';
import { useTurnMentionReadings } from './useTurnMentionReadings';

const turn = (turnId: string, narration: string): ChatMessage => ({ role: 'assistant', content: JSON.stringify({ turnId, narration, choices: [] }) });
const MIRA = { id: 'mira', name: 'Mira', aliases: [], kind: 'unique' } as unknown as Entity;
const ASH = { id: 'ash', names: ['Ash'] };
const reading = (text: string): PassageReading => ({ model: 'small', version: 1, reading: { mentions: [{ start: 0, end: text.indexOf(' '), entityId: 'mira' }], quotes: [] }, clusters: [], clusterEntities: [] });

/** A controller whose readings resolve only when the test says so. */
function controller() {
  const pending: { text: string; resolve: (r: PassageReading) => void; reject: (e: Error) => void }[] = [];
  const readPassage = vi.fn((text: string) => new Promise<PassageReading | null>((resolve, reject) => pending.push({ text, resolve, reject })));
  return { controller: { readPassage } as unknown as CharacterMentions, readPassage, pending };
}

type Props = { history: ChatMessage[]; busy: boolean; ready: boolean };

function mount(c: CharacterMentions, initial: Props, start: MentionReadingMap = {}) {
  return renderHook((props: Props) => {
    const [readings, setReadings] = useState<MentionReadingMap>(start);
    useTurnMentionReadings({ controller: c, ...props, readings, setReadings, cast: [MIRA], player: ASH });
    return readings;
  }, { initialProps: initial });
}

describe('reading finished passages on their turn', () => {
  it('stores the reading on the newest turn once its passage finishes', async () => {
    const c = controller();
    const hook = mount(c.controller, { history: [turn('t1', 'Mira left.')], busy: true, ready: true });
    expect(c.readPassage).not.toHaveBeenCalled(); // still running

    hook.rerender({ history: [turn('t1', 'Mira left.')], busy: false, ready: true });
    expect(c.readPassage).toHaveBeenCalledWith('Mira left.', [MIRA], { player: ASH });
    await act(async () => c.pending[0].resolve(reading('Mira left.')));
    expect(hook.result.current.t1).toMatchObject({ model: 'small', textHash: narrationHash('Mira left.') });
  });

  it('keeps the reading version and the cast ids the reading voted with', async () => {
    const c = controller();
    const hook = mount(c.controller, { history: [turn('t1', 'Mira left.')], busy: false, ready: true });
    await act(async () => c.pending[0].resolve(reading('Mira left.')));
    expect(hook.result.current.t1).toMatchObject({ readingVersion, castIds: ['mira'] });
  });

  it('lets the next turn run while a reading is unanswered, then reads it and keeps both', async () => {
    const c = controller();
    const hook = mount(c.controller, { history: [turn('t1', 'Mira left.')], busy: false, ready: true });
    // The player sends the next turn while the first reading is unanswered.
    hook.rerender({ history: [turn('t1', 'Mira left.')], busy: true, ready: true });
    hook.rerender({ history: [turn('t1', 'Mira left.'), turn('t2', 'Mira came back.')], busy: false, ready: true });
    await act(async () => c.pending[0].resolve(reading('Mira left.')));
    await waitFor(() => expect(c.readPassage).toHaveBeenLastCalledWith('Mira came back.', [MIRA], { player: ASH }));
    await act(async () => c.pending[1].resolve(reading('Mira came back.')));
    expect(Object.keys(hook.result.current).sort()).toEqual(['t1', 't2']);
  });

  it('drops a reading whose turn was regenerated while it ran', async () => {
    const c = controller();
    const hook = mount(c.controller, { history: [turn('t1', 'Mira left.')], busy: false, ready: true });
    hook.rerender({ history: [turn('t1b', 'Mira stayed.')], busy: false, ready: true });
    await act(async () => c.pending[0].resolve(reading('Mira left.')));
    await waitFor(() => expect(c.pending).toHaveLength(2));
    await act(async () => c.pending[1].resolve(reading('Mira stayed.')));
    await waitFor(() => expect(Object.keys(hook.result.current)).toEqual(['t1b']));
  });

  it('reads an edited older turn again, but never backfills one that had no reading', async () => {
    const c = controller();
    const start: MentionReadingMap = {
      t1: { ...reading('Mira left.'), textHash: narrationHash('Mira left.') },
      t3: { ...reading('Mira slept.'), textHash: narrationHash('Mira slept.') },
    };
    // t2 never had a reading; t1 is edited.
    const history = [turn('t1', 'Mira ran.'), turn('t2', 'Mira hid.'), turn('t3', 'Mira slept.')];
    mount(c.controller, { history, busy: false, ready: true }, start);
    expect(c.readPassage).toHaveBeenCalledWith('Mira ran.', [MIRA], { player: ASH });
    await act(async () => c.pending[0].resolve(reading('Mira ran.')));
    expect(c.readPassage).toHaveBeenCalledTimes(1);
  });

  it('does not retry a passage the reading failed on', async () => {
    const c = controller();
    mount(c.controller, { history: [turn('t1', 'Mira left.')], busy: false, ready: true });
    await act(async () => c.pending[0].reject(new Error('worker died')));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(c.readPassage).toHaveBeenCalledTimes(1);
  });

  it('reads nothing while the model is not ready', () => {
    const c = controller();
    mount(c.controller, { history: [turn('t1', 'Mira left.')], busy: false, ready: false });
    expect(c.readPassage).not.toHaveBeenCalled();
  });
});
