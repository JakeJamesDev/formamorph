import { describe, it, expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { EditorPreviewRollsProvider, useEditorPreviewRolls, type EditorPreviewRolls } from './EditorPreviewRollsContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider, usePlaceholderSession } from './PlaceholderSessionContext';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValueId, phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

vi.mock('@/services/WorldStorageService', () => {
  const stub = { initialize: () => Promise.resolve(), getAllWorldMetadata: () => Promise.resolve([]) };
  return { WorldStorageService: stub, default: stub };
});

const tok = (id: string, placementId: string, mode: 'world' | 'unique' = 'world') =>
  encodePlaceholderToken({ id, mode, placementId });

const hair: Placeholder = { id: 'hair', name: 'Hair', values: phValues(['brown', 'black']) };
const eyes: Placeholder = { id: 'eyes', name: 'Eyes', values: phValues(['blue', 'green']) };
// Molly's values are chips of Hair, so rerolling Molly has to redraw Hair too.
const molly: Placeholder = { id: 'molly', name: 'Molly', values: phValues([`${tok('hair', 'v1')} hair`, `${tok('hair', 'v2')} mane`]) };
const world = [hair, eyes, molly];

function mount(inside?: (children: React.ReactNode) => React.ReactElement) {
  let store: EditorPreviewRolls | null = null;
  let session: ReturnType<typeof usePlaceholderSession> | null = null;
  const Probe = () => { store = useEditorPreviewRolls(); return null; };
  const SessionProbe = () => { session = usePlaceholderSession(); return null; };
  const tree = (
    <EditorPreviewRollsProvider>
      <Probe />
      {inside ? <SessionProbe /> : null}
    </EditorPreviewRollsProvider>
  );
  render(inside ? inside(tree) : tree);
  return {
    read: (text: string) => {
      if (!store) throw new Error('probe never rendered');
      return store.preview(text, world);
    },
    readWith: (text: string, placeholders: Placeholder[]) => {
      if (!store) throw new Error('probe never rendered');
      return store.preview(text, placeholders);
    },
    reroll: (ids: string[]) => act(() => { store?.reroll(ids, world); }),
    choose: (placement: Parameters<EditorPreviewRolls['setRoll']>[0], valueId: string) =>
      act(() => { store?.setRoll(placement, valueId); }),
    version: () => store?.version,
    session: () => session,
  };
}

/** Draw until two reads differ, or give up — a redraw over two values lands on the other one soon. */
const drawsDiffer = (draw: () => string, from: string) => {
  for (let i = 0; i < 40; i++) if (draw() !== from) return true;
  return false;
};

/** `ph` with `text` re-spelled under its own id. Its weight is zero, so a redraw never lands on the new
 *  spelling and only a kept roll can show it. */
const respell = (ph: Placeholder, text: string): Placeholder => ({
  ...ph,
  values: (ph.values ?? []).map((v) => (v.text === text ? { ...v, text: `${text}ish` } : v)),
  weights: { [phValueId(text)]: 0 },
});

describe('EditorPreviewRollsProvider', () => {
  it('returns the same value on two reads, and across two fields reading one placeholder', () => {
    const h = mount();
    const a = tok('hair', 'p1');
    const b = tok('hair', 'p2');
    const first = h.read(a)[a];
    expect(h.read(a)[a]).toBe(first);
    expect(h.read(b)[b]).toBe(first);
  });

  it('rerolls one id and everything reachable through its values, and nothing else', () => {
    const h = mount();
    const m = tok('molly', 'p1');
    const e = tok('eyes', 'p2');
    const hairBefore = h.read(tok('hair', 'p3'))[tok('hair', 'p3')];
    const eyesBefore = h.read(e)[e];
    h.read(m);
    expect(drawsDiffer(() => {
      h.reroll(['molly']);
      return h.read(tok('hair', 'p3'))[tok('hair', 'p3')];
    }, hairBefore)).toBe(true);
    expect(h.read(e)[e]).toBe(eyesBefore);
  });

  it('rerolls a Unique placement by the placeholder it belongs to', () => {
    const h = mount();
    const u = tok('hair', 'u1', 'unique');
    const before = h.read(u)[u];
    expect(drawsDiffer(() => { h.reroll(['hair']); return h.read(u)[u]; }, before)).toBe(true);
  });

  it('drops a roll the author has edited out of the pool, so a Preview never shows text that is gone', () => {
    const h = mount();
    const t = tok('hair', 'p1');
    const before = h.read(t)[t];
    const renamed: Placeholder = { ...hair, values: phValues(['silver', 'copper']) };
    const after = h.readWith(t, [renamed, eyes, molly])[t];
    expect(['silver', 'copper']).toContain(after);
    expect(after).not.toBe(before);
  });

  it('keeps a rolled value rolled when the author re-spells it', () => {
    const h = mount();
    const t = tok('hair', 'p1');
    const before = h.read(t)[t];
    const respelled = respell(hair, before);
    expect(h.readWith(t, [respelled, eyes, molly])[t]).toBe(`${before}ish`);
    expect(h.readWith(tok('hair', 'p2'), [respelled, eyes, molly])[tok('hair', 'p2')]).toBe(`${before}ish`);
  });

  it('keeps a nested Unique roll through a re-spelling of the nested value', () => {
    const h = mount();
    const u = tok('molly', 'u1', 'unique');
    const before = h.read(u)[u];
    const hairText = before.replace(/ (hair|mane)$/, '');
    const respelled = respell(hair, hairText);
    const after = h.readWith(u, [respelled, eyes, molly])[u];
    expect(after).toBe(before.replace(hairText, `${hairText}ish`));
  });

  it('points every World reader at the value a directed set chooses', () => {
    const h = mount();
    const a = tok('hair', 'p1');
    const b = tok('hair', 'p2');
    const other = h.read(a)[a] === 'brown' ? 'black' : 'brown';
    const version = h.version();
    h.choose({ id: 'hair', mode: 'world', placementId: 'p1' }, phValueId(other));
    expect(h.version()).not.toBe(version);
    expect(h.read(a)[a]).toBe(other);
    expect(h.read(b)[b]).toBe(other);
  });

  it('moves only the one Unique placement a directed set names', () => {
    const h = mount();
    const u1 = tok('eyes', 'u1', 'unique');
    const u2 = tok('eyes', 'u2', 'unique');
    const w = tok('eyes', 'w1');
    const u2Before = h.read(u2)[u2];
    const wBefore = h.read(w)[w];
    for (const pick of ['blue', 'green']) {
      h.choose({ id: 'eyes', mode: 'unique', placementId: 'u1' }, phValueId(pick));
      expect(h.read(u1)[u1]).toBe(pick);
      expect(h.read(u2)[u2]).toBe(u2Before);
      expect(h.read(w)[w]).toBe(wBefore);
    }
  });

  it('rerolls a Unique placement a directed set chose', () => {
    const h = mount();
    const u = tok('hair', 'u1', 'unique');
    h.choose({ id: 'hair', mode: 'unique', placementId: 'u1' }, phValueId('brown'));
    expect(h.read(u)[u]).toBe('brown');
    expect(drawsDiffer(() => { h.reroll(['hair']); return h.read(u)[u]; }, 'brown')).toBe(true);
  });

  it('never writes to the session context', () => {
    const h = mount((tree) => (
      <GameDataProvider>
        <PlaceholderSessionProvider>{tree}</PlaceholderSessionProvider>
      </GameDataProvider>
    ));
    h.read(tok('hair', 'p1'));
    h.reroll(['hair']);
    expect(h.session()?.rolls).toEqual({});
  });
});
