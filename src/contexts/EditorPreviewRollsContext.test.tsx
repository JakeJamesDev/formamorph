import { describe, it, expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { EditorPreviewRollsProvider, useEditorPreviewRolls, type EditorPreviewRolls } from './EditorPreviewRollsContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider, usePlaceholderSession } from './PlaceholderSessionContext';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
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
    session: () => session,
  };
}

/** Draw until two reads differ, or give up — a redraw over two values lands on the other one soon. */
const drawsDiffer = (draw: () => string, from: string) => {
  for (let i = 0; i < 40; i++) if (draw() !== from) return true;
  return false;
};

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
