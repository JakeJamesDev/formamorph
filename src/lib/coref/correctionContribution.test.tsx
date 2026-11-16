import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import AuthService from '@/services/AuthService';
import { contributeTurn, contributionNames, type Contributor, type TurnContribution } from './correctionContribution';
import { addMentionCorrection, type MentionCorrection } from './mentionCorrections';
import { narrationHash, type TurnMentionReading } from './mentionReadings';
import { useContributeAccess } from './useContributeAccess';

const ageGate = vi.hoisted(() => ({ attested: true }));
vi.mock('@/contexts/AgeGateContext', () => ({ useAgeAttested: () => ageGate.attested }));

// A synthetic passage written for these guards.
const PASSAGE = 'Mira met the courier. She nodded at him.';
const span = (piece: string): [number, number] => [PASSAGE.indexOf(piece), PASSAGE.indexOf(piece) + piece.length];

const entry: TurnMentionReading = {
  model: 'big',
  version: 3,
  textHash: narrationHash(PASSAGE),
  reading: { mentions: [], quotes: [] },
  clusters: [[span('Mira'), span('She')], [span('the courier'), span('him')]],
  clusterEntities: ['mira', null],
};
const herIsKessa: MentionCorrection = { kind: 'mention', start: span('She')[0], end: span('She')[1], entityId: 'kessa' };
// The cast and the persona by id, as play resolved them; the reading never linked Ash.
const NAMES = new Map([['mira', 'Mira'], ['kessa', 'Kessa'], ['ash', 'Ash']]);
const turn = (over: Partial<TurnContribution> = {}): TurnContribution => ({
  worldId: 'world-1', passage: PASSAGE, entry, corrections: [herIsKessa], names: NAMES, ...over,
});
const A: Contributor = { access: 'ready', accountId: 'acct-a' };
const B: Contributor = { access: 'ready', accountId: 'acct-b' };

/** Another tab signs this device in as `id`; the session reaches this tab through the storage event. */
function signInElsewhere(id: string | null): void {
  if (id) {
    localStorage.setItem('authToken', `tok-${id}`);
    localStorage.setItem('currentUser', JSON.stringify({ id, username: id }));
  } else {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
  }
  window.dispatchEvent(new StorageEvent('storage', { key: 'authToken' }));
}

let fetchSpy: MockInstance<typeof fetch>;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ success: true }), { status: 201 }));
});
afterEach(() => {
  vi.restoreAllMocks();
  AuthService.logout();
});

const posts = () => fetchSpy.mock.calls.filter(([url]) => /\/coref-contributions$/.test(String(url)));

describe('sending a correction to the review queue', () => {
  it('sends nothing with the setting off', async () => {
    expect(await contributeTurn(null, A, turn())).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends nothing signed out or without the 18+ confirmation', async () => {
    expect(await contributeTurn('acct-a', { access: 'signedOut', accountId: null }, turn())).toBe(false);
    expect(await contributeTurn('acct-a', { access: 'unattested', accountId: 'acct-a' }, turn())).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends nothing for another account than the one that opted in (Q60)', async () => {
    expect(await contributeTurn('acct-a', B, turn())).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts once with the full passage, the model, the clusters and the corrections', async () => {
    AuthService.token = 'tok';
    expect(await contributeTurn('acct-a', A, turn())).toBe(true);
    expect(posts()).toHaveLength(1);
    const [, init] = posts()[0];
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(init?.body))).toEqual({
      worldId: 'world-1',
      passage: PASSAGE,
      modelId: 'big',
      modelVersion: 3,
      clusters: [[span('Mira'), span('She')], [span('the courier'), span('him')]],
      clusterEntities: ['mira', null],
      corrections: [herIsKessa],
      entityNames: { mira: 'Mira', kessa: 'Kessa' },
    });
  });

  it('names only the entities the clusters and corrections reference, the persona included', async () => {
    const toPersona: MentionCorrection = { ...herIsKessa, entityId: 'ash' };
    await contributeTurn('acct-a', A, turn({ corrections: [toPersona], names: contributionNames([{ id: 'mira', name: 'Mira' }], { id: 'ash', name: 'Ash' }) }));
    expect(JSON.parse(String(posts()[0][1]?.body)).entityNames).toEqual({ mira: 'Mira', ash: 'Ash' });
  });

  it('leaves out a name the server would refuse, so the send still goes out', async () => {
    const names = new Map([['mira', '   '], ['kessa', 'K'.repeat(201)]]);
    expect(await contributeTurn('acct-a', A, turn({ names }))).toBe(true);
    expect(JSON.parse(String(posts()[0][1]?.body)).entityNames).toEqual({});
  });

  it('sends a 200-character name whole, as play resolved it', async () => {
    const long = 'K'.repeat(200);
    await contributeTurn('acct-a', A, turn({ names: new Map([['kessa', long], ['mira', ' Mira ']]) }));
    expect(JSON.parse(String(posts()[0][1]?.body)).entityNames).toEqual({ kessa: long, mira: ' Mira ' });
  });

  it('sends every correction of the turn so far, with its kind', async () => {
    const quote: MentionCorrection = { kind: 'quote', start: 0, end: 4, entityId: null };
    let map = addMentionCorrection({}, 't1', entry.textHash, herIsKessa);
    map = addMentionCorrection(map, 't1', entry.textHash, quote);
    await contributeTurn('acct-a', A, turn({ corrections: map.t1.corrections }));
    expect(JSON.parse(String(posts()[0][1]?.body)).corrections).toEqual([herIsKessa, quote]);
  });

  it('sends a non-mention with its kind and a null entity, and a "Not Listed" mention as a null mention', async () => {
    const notPerson: MentionCorrection = { ...herIsKessa, kind: 'nonMention', entityId: null };
    const notListed: MentionCorrection = { ...herIsKessa, entityId: null };
    await contributeTurn('acct-a', A, turn({ corrections: [notPerson] }));
    await contributeTurn('acct-a', A, turn({ corrections: [notListed] }));
    expect(JSON.parse(String(posts()[0][1]?.body)).corrections).toEqual([notPerson]);
    expect(JSON.parse(String(posts()[1][1]?.body)).corrections).toEqual([notListed]);
  });

  it('sends nothing for a reading without clusters, another narration, or no world', async () => {
    const { clusters: _c, clusterEntities: _e, ...older } = entry;
    expect(await contributeTurn('acct-a', A, turn({ entry: older }))).toBe(false);
    expect(await contributeTurn('acct-a', A, turn({ passage: `${PASSAGE} Then rain.` }))).toBe(false);
    expect(await contributeTurn('acct-a', A, turn({ worldId: null }))).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps a failed send local without throwing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ success: false, error: 'Too many' }), { status: 429 }));
    expect(await contributeTurn('acct-a', A, turn())).toBe(false);
  });
});

describe('who may contribute', () => {
  it('needs a sign-in, then the 18+ confirmation', () => {
    ageGate.attested = false;
    const hook = renderHook(() => useContributeAccess());
    expect(hook.result.current).toEqual({ access: 'signedOut', accountId: null });

    act(() => signInElsewhere('acct-a'));
    expect(hook.result.current).toEqual({ access: 'unattested', accountId: 'acct-a' });

    ageGate.attested = true;
    hook.rerender();
    expect(hook.result.current).toEqual(A);
  });

  it('follows a sign-out', () => {
    ageGate.attested = true;
    act(() => signInElsewhere('acct-a'));
    const hook = renderHook(() => useContributeAccess());
    expect(hook.result.current).toEqual(A);
    act(() => AuthService.logout());
    expect(hook.result.current.access).toBe('signedOut');
  });

  it('sends nothing once another account signs in on the device (Q60)', async () => {
    ageGate.attested = true;
    act(() => signInElsewhere('acct-a'));
    const hook = renderHook(() => useContributeAccess());
    const optedIn = hook.result.current.accountId;

    act(() => signInElsewhere('acct-b'));
    expect(hook.result.current).toEqual(B);
    expect(await contributeTurn(optedIn, hook.result.current, turn())).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
