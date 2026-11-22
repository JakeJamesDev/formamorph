import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import AuthService from '@/services/AuthService';
import { contributeTurn, type Contributor, type TurnContribution } from './correctionContribution';
import { APP_VERSION } from '@/lib/version';
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
// The cast as play resolved it; the persona Ash is apart, and the reading never linked her.
const MIRA = { id: 'mira', name: 'Mira', aliases: ['the captain'], strangerName: 'a tall woman' };
const KESSA = { id: 'kessa', name: 'Kessa' };
const ASH = { id: 'ash', name: 'Ash', aliases: ['Ashen'] };
const turn = (over: Partial<TurnContribution> = {}): TurnContribution => ({
  worldId: 'world-1', passage: PASSAGE, entry, corrections: [herIsKessa], entities: [MIRA, KESSA], persona: ASH, ...over,
});
const sent = () => JSON.parse(String(posts().at(-1)?.[1]?.body));
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
      playerId: 'ash',
      cast: [
        { id: 'mira', name: 'Mira', aliases: ['the captain'], strangerName: 'a tall woman', kind: 'unique' },
        { id: 'kessa', name: 'Kessa', aliases: [], strangerName: null, kind: 'unique' },
        { id: 'ash', name: 'Ash', aliases: ['Ashen'], strangerName: null, kind: null },
      ],
      clientVersion: APP_VERSION,
    });
  });

  it('names only the entities the clusters and corrections reference, the persona included', async () => {
    const toPersona: MentionCorrection = { ...herIsKessa, entityId: 'ash' };
    await contributeTurn('acct-a', A, turn({ corrections: [toPersona] }));
    expect(sent().entityNames).toEqual({ mira: 'Mira', ash: 'Ash' });
  });

  it('leaves out a name the server would refuse, so the send still goes out', async () => {
    const entities = [{ id: 'mira', name: '   ' }, { id: 'kessa', name: 'K'.repeat(201) }];
    expect(await contributeTurn('acct-a', A, turn({ entities }))).toBe(true);
    expect(sent().entityNames).toEqual({});
  });

  it('sends a 200-character name whole, as play resolved it', async () => {
    const long = 'K'.repeat(200);
    await contributeTurn('acct-a', A, turn({ entities: [{ id: 'kessa', name: long }, { id: 'mira', name: ' Mira ' }] }));
    expect(sent().entityNames).toEqual({ kessa: long, mira: ' Mira ' });
  });

  it('leaves out an alias or stranger name over the bound and keeps the record, so the send goes out', async () => {
    const mira = { ...MIRA, aliases: ['ok', 'A'.repeat(201), '  '], strangerName: 'S'.repeat(201) };
    expect(await contributeTurn('acct-a', A, turn({ entities: [mira, KESSA] }))).toBe(true);
    expect(sent().cast[0]).toEqual({ id: 'mira', name: 'Mira', aliases: ['ok'], strangerName: null, kind: 'unique' });
  });

  it('caps a record at 20 aliases and the cast at 200 records', async () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ id: `e${i}`, name: `E${i}`, aliases: Array.from({ length: 30 }, (__, j) => `a${j}`) }));
    const crowded: TurnMentionReading = { ...entry, castIds: many.map((e) => e.id) };
    await contributeTurn('acct-a', A, turn({ entry: crowded, entities: many }));
    expect(sent().cast).toHaveLength(200);
    expect(sent().cast[0].aliases).toHaveLength(20);
    expect(sent().cast.at(-1).id).toBe('ash');
  });

  it('sends the cast the reading voted with, a generic entity as generic', async () => {
    const reading: TurnMentionReading = { ...entry, castIds: ['mira', 'guard'] };
    const entities = [MIRA, KESSA, { id: 'guard', name: 'Guard', kind: 'generic' as const }];
    await contributeTurn('acct-a', A, turn({ entry: reading, entities }));
    expect(sent().cast.map((c: { id: string; kind: string | null }) => [c.id, c.kind])).toEqual([['mira', 'unique'], ['guard', 'generic'], ['ash', null]]);
  });

  it('sends playerId as null without a persona, and no persona record', async () => {
    await contributeTurn('acct-a', A, turn({ persona: undefined }));
    expect(sent().playerId).toBeNull();
    expect(sent().cast.map((c: { id: string }) => c.id)).toEqual(['mira', 'kessa']);
  });
});

describe('the quotes a contribution sends', () => {
  const QUOTED = 'Mira said "Come here," and Ash did. "Fine," she said.';
  const q1 = QUOTED.indexOf('"Come here,"');
  const q2 = QUOTED.indexOf('"Fine,"');
  const quoted = (quotes: TurnMentionReading['reading']['quotes'], over: Partial<TurnMentionReading> = {}): TurnMentionReading => ({
    ...entry, textHash: narrationHash(QUOTED), clusters: [[[0, 4]]], clusterEntities: ['mira'], reading: { mentions: [], quotes }, ...over,
  });
  const quoteFix: MentionCorrection = { kind: 'quote', start: q1, end: q1 + 12, entityId: 'kessa' };
  const shown = { start: q1, end: q1 + 12, speaker: 'mira', rule: 'after-subject-verb' as const, mention: { start: 0, end: 4 }, firstPerson: [] };

  it('holds the speaker the reading showed, its rule, mention and first person, beside the correction', async () => {
    const entryWith = quoted([{ ...shown, firstPerson: [{ start: q2 + 1, end: q2 + 5 }] }, { start: q2, end: q2 + 7, speaker: null, rule: 'none', mention: null, firstPerson: [] }]);
    await contributeTurn('acct-a', A, turn({ passage: QUOTED, entry: entryWith, corrections: [quoteFix] }));
    expect(sent().quotes).toEqual([
      { start: q1, end: q1 + 12, speakerId: 'mira', rule: 'after-subject-verb', mention: { start: 0, end: 4 }, firstPerson: [{ start: q2 + 1, end: q2 + 5 }] },
      { start: q2, end: q2 + 7, speakerId: null, rule: 'none', mention: null, firstPerson: [] },
    ]);
    expect(sent().corrections).toEqual([quoteFix]);
  });

  it('sends a fallback rule with the quote', async () => {
    const withFallback = [{ ...shown, fallback: 'earlier-quote' as const }];
    await contributeTurn('acct-a', A, turn({ passage: QUOTED, entry: quoted(withFallback), corrections: [quoteFix] }));
    expect(sent().quotes[0]).toMatchObject({ rule: 'after-subject-verb', fallback: 'earlier-quote' });
  });

  it('sends a turn read before the records, with no quotes and no reading version', async () => {
    const old = quoted([{ start: q1, end: q1 + 12, speaker: 'mira' }]);
    expect(await contributeTurn('acct-a', A, turn({ passage: QUOTED, entry: old, corrections: [quoteFix] }))).toBe(true);
    expect(sent()).not.toHaveProperty('quotes');
    expect(sent()).not.toHaveProperty('readingVersion');
  });

  it('sends the reading version the turn was read at', async () => {
    await contributeTurn('acct-a', A, turn({ passage: QUOTED, entry: quoted([shown], { readingVersion: 2 }), corrections: [quoteFix] }));
    expect(sent().readingVersion).toBe(2);
  });

  it('leaves out a span the server would refuse, so the send still goes out', async () => {
    const splitWord = { ...shown, start: q1 + 2, end: q1 + 12 };
    const badMention = { ...shown, start: q2, end: q2 + 7, mention: { start: 1, end: 3 }, firstPerson: [{ start: 1, end: 3 }, { start: 0, end: 4 }] };
    expect(await contributeTurn('acct-a', A, turn({ passage: QUOTED, entry: quoted([splitWord, badMention]), corrections: [quoteFix] }))).toBe(true);
    expect(sent().quotes).toEqual([
      { start: q2, end: q2 + 7, speakerId: 'mira', rule: 'after-subject-verb', mention: null, firstPerson: [{ start: 0, end: 4 }] },
    ]);
  });
});

describe('the corrections a contribution sends', () => {
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
