import { describe, expect, it } from 'vitest';
import type { ChatMessage, ScriptTiming } from '@/types';
import { silentPrompts } from './scriptPrompts';
import {
  addTell, latestTurnId, placeTells, pruneTells, REROLLED_TIMINGS, restoreTells, setTurnTells, tellHost, turnTells, withoutTimings,
} from './scriptTells';

const turn = (turnId: string): ChatMessage => ({ role: 'assistant', content: JSON.stringify({ narration: 'x', choices: [], turnId }) });
const action: ChatMessage = { role: 'user', content: 'I wait.' };

describe('script tells', () => {
  it('keeps a turn’s tells in call order', () => {
    const map = addTell(addTell({}, 't1', { text: 'First.', timing: 'before' }), 't1', { text: 'Second.', timing: 'after' });
    expect(turnTells(map, 't1')).toEqual([{ text: 'First.', timing: 'before' }, { text: 'Second.', timing: 'after' }]);
    expect(turnTells(map, 't2')).toEqual([]);
    expect(turnTells(map, undefined)).toEqual([]);
  });

  it('drops only the re-rolled timings, keeping a switch tell in place', () => {
    const map = {
      t1: [
        { text: 'Start.', timing: 'start' as const }, { text: 'Switched.', timing: 'switch' as const },
        { text: 'Before.', timing: 'before' as const }, { text: 'After.', timing: 'after' as const },
      ],
    };
    expect(withoutTimings(map, 't1', REROLLED_TIMINGS)).toEqual({ t1: [{ text: 'Switched.', timing: 'switch' }] });
    expect(withoutTimings({ t1: [{ text: 'Before.', timing: 'before' }] }, 't1', REROLLED_TIMINGS)).toEqual({});
  });

  it('sets a turn’s tells, and none removes the entry', () => {
    const tell = { text: 'Back.', timing: 'before' as const };
    expect(setTurnTells({}, 't1', [tell])).toEqual({ t1: [tell] });
    expect(setTurnTells({ t1: [tell] }, 't1', [])).toEqual({});
  });

  it('reads the newest turn’s id, and none before the first narration', () => {
    expect(latestTurnId([action])).toBeUndefined();
    expect(latestTurnId([action, turn('t1'), action, turn('t2')])).toBe('t2');
  });

  it('drops the tells of a turn that left the history', () => {
    const map = { t1: [{ text: 'Kept.', timing: 'before' as const }], t2: [{ text: 'Rolled back.', timing: 'before' as const }] };
    expect(pruneTells(map, [action, turn('t1')])).toEqual({ t1: [{ text: 'Kept.', timing: 'before' }] });
  });

  it('drops and restores images with the re-rolled timings, keeping During AI Output ones', () => {
    const tells = [
      { image: 'm-start', size: 'medium' as const, wrap: 'block' as const, timing: 'start' as const },
      { image: 'm-before', size: 'small' as const, wrap: 'block' as const, timing: 'before' as const },
      { image: 'm-output', size: 'medium' as const, wrap: 'left' as const, sentence: 2, timing: 'output' as const },
      { text: 'After.', timing: 'after' as const },
      { image: 'm-after', size: 'large' as const, wrap: 'block' as const, timing: 'after' as const },
    ];
    const rolled = withoutTimings({ t1: tells }, 't1', REROLLED_TIMINGS);
    expect(rolled).toEqual({ t1: [tells[2]] });
    expect(setTurnTells(rolled, 't1', tells)).toEqual({ t1: tells });
  });

  it('places Start and Before images above, During AI Output images inline, and the rest below in call order', () => {
    const image = (id: string, timing: ScriptTiming) => ({ image: id, size: 'medium' as const, wrap: 'block' as const, timing });
    const tells = [
      { text: 'Before tell.', timing: 'before' as const }, image('a-after', 'after'), image('b-before', 'before'),
      { text: 'After tell.', timing: 'after' as const }, image('c-start', 'start'), image('d-output', 'output'), image('e-switch', 'switch'),
    ];
    expect(placeTells(tells)).toEqual({
      above: [image('b-before', 'before'), image('c-start', 'start')],
      inline: [image('d-output', 'output')],
      below: [tells[0], image('a-after', 'after'), tells[3], image('e-switch', 'switch')],
    });
  });

  it('records a tell and a show with the run’s timing, and passes a toast on', async () => {
    const recorded: unknown[] = [];
    const toasts: string[] = [];
    const host = tellHost(silentPrompts, 'after', (tell) => recorded.push(tell), (text) => toasts.push(text));
    await host.prompt({ kind: 'tell', text: 'Hi.' });
    await host.prompt({ kind: 'show', name: 'Gull', mediaId: 'm-gull', size: 'small', wrap: 'right' });
    await host.prompt({ kind: 'toast', text: 'Saved.' });
    expect(recorded).toEqual([{ text: 'Hi.', timing: 'after' }, { image: 'm-gull', size: 'small', wrap: 'block', timing: 'after' }]);
    expect(toasts).toEqual(['Saved.']);
  });

  it('reads back image tells beside text ones, dropping malformed images', () => {
    const good = { image: 'm-1', size: 'large', wrap: 'block', timing: 'before' };
    const anchored = { image: 'm-2', size: 'small', wrap: 'left', sentence: 3, timing: 'output' };
    expect(restoreTells({
      t1: [
        { text: 'Hi.', timing: 'after' }, good, anchored,
        { ...good, image: 7 }, { ...good, size: 'huge' }, { ...good, wrap: 'up' }, { ...good, timing: 'later' },
        { ...anchored, sentence: -1 }, { ...anchored, sentence: 1.5 }, { size: 'small', wrap: 'block', timing: 'after' },
        { ...good, stray: true },
      ],
    })).toEqual({ t1: [{ text: 'Hi.', timing: 'after' }, good, anchored, good] });
  });

  it('reads back only well-formed tells from a save', () => {
    expect(restoreTells({
      t1: [{ text: 'Hi.', timing: 'after' }, { text: 'No timing.' }, { text: 'Bad.', timing: 'later' }, 'bare', null],
      t2: 'no',
      t3: [],
    })).toEqual({ t1: [{ text: 'Hi.', timing: 'after' }] });
    expect(restoreTells(undefined)).toEqual({});
    expect(restoreTells('junk')).toEqual({});
  });
});
