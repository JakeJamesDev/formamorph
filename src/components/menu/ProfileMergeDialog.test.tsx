import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProfileMergeDialog } from './ProfileMergeDialog';
import { useProfileMerge } from './useProfileMerge';
import { devProfileMergeView } from '@/lib/devProfileMergeSample';
import type { MergeCategory, MergeItem } from '@/lib/profileMerge/engine';
import type { ProfileMergeBridge } from '@/lib/profileMerge/bridge';

const handlers = () => ({ onMerge: vi.fn(), onNotNow: vi.fn(), onDecline: vi.fn(), onDone: vi.fn() });

describe('ProfileMergeDialog', () => {
  it('offers Merge, Not Now and Don\'t Merge with counts per category', () => {
    const h = handlers();
    render(<ProfileMergeDialog view={devProfileMergeView('offer')} {...h} />);
    expect(screen.getByText('Entities').nextSibling?.textContent).toBe('5 new · 1 replaces yours · 3 kept');
    fireEvent.click(screen.getByRole('button', { name: "Don't Merge" }));
    fireEvent.click(screen.getByRole('button', { name: 'Not Now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    expect(h.onDecline).toHaveBeenCalledOnce();
    expect(h.onNotNow).toHaveBeenCalledOnce();
    expect(h.onMerge).toHaveBeenCalledOnce();
  });

  it('locks the run: no close control, and Escape and an outside click do nothing', () => {
    const h = handlers();
    render(<ProfileMergeDialog view={devProfileMergeView('run')} {...h} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelectorAll('button')).toHaveLength(0);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(Object.values(h).some((fn) => fn.mock.calls.length > 0)).toBe(false);
    expect(screen.getAllByRole('progressbar')).toHaveLength(4);
  });

  it('closes the offer on Escape as Not Now', () => {
    const h = handlers();
    render(<ProfileMergeDialog view={devProfileMergeView('offer')} {...h} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(h.onNotNow).toHaveBeenCalledOnce();
    expect(h.onDecline).not.toHaveBeenCalled();
  });

  it('lists skipped items with reasons in the result', () => {
    render(<ProfileMergeDialog view={devProfileMergeView('result')} {...handlers()} />);
    expect(screen.getByText('Sedge Landing')).toBeTruthy();
    expect(screen.getByText(/enough storage space/)).toBeTruthy();
  });
});

const item = (id: string, size = 1): MergeItem => ({ id, label: id, stamp: '2026-06-01T00:00:00.000Z', size });

function fakeBridge(offer: { merged: string[] } | null = { merged: [] }) {
  const marks: string[] = [];
  const bridge: ProfileMergeBridge = {
    offer: vi.fn(async () => offer),
    summaries: vi.fn(async () => ({})),
    record: vi.fn(async () => null),
    later: vi.fn(async () => {}),
    mark: vi.fn(async (state, categories) => { marks.push(categories ? `${state}:${categories.join(',')}` : state); return true; }),
  };
  return { bridge, marks };
}

function category(key: string, source: MergeItem[], log: string[], target: MergeItem[] = []): MergeCategory {
  return {
    key, label: key, stamped: true, unit: 'items',
    source: async () => source,
    target: async () => target,
    copy: async (i) => { log.push(`${key}:${i.id}`); },
  };
}

describe('useProfileMerge', () => {
  it('writes the done marker only after the last category finishes', async () => {
    const { bridge, marks } = fakeBridge();
    const log: string[] = [];
    const bridgeMark = bridge.mark;
    bridge.mark = vi.fn(async (state, categories) => { log.push(`mark:${state}`); return bridgeMark(state, categories); });
    const categoriesOf = () => [category('a', [item('1')], log), category('b', [item('2', 5), item('3', 9)], log)];
    const onMerged = vi.fn();
    const { result } = renderHook(() => useProfileMerge({ bridge, categoriesOf, onMerged }));
    await waitFor(() => expect(result.current.view?.step).toBe('offer'));
    await act(() => result.current.merge());
    expect(log).toEqual(['a:1', 'b:2', 'b:3', 'mark:done']);
    expect(marks).toEqual(['done:a,b']);
    expect(result.current.view?.step).toBe('result');
    expect(onMerged).toHaveBeenCalledOnce();
  });

  it('shows the stop reason when the marker cannot be written', async () => {
    const { bridge } = fakeBridge();
    const categoriesOf = () => [category('a', [item('1')], [])];
    const { result } = renderHook(() => useProfileMerge({ bridge, categoriesOf, onMerged: () => {} }));
    await waitFor(() => expect(result.current.view?.step).toBe('offer'));
    bridge.mark = vi.fn(async () => { throw new Error('The disk is full.'); });
    await act(() => result.current.merge());
    expect(result.current.view).toMatchObject({ step: 'result', error: 'The disk is full' });
  });

  it("writes the declined marker on Don't Merge and nothing on Not Now", async () => {
    const declined = fakeBridge();
    const categoriesOf = () => [category('a', [item('1')], [])];
    const first = renderHook(() => useProfileMerge({ bridge: declined.bridge, categoriesOf, onMerged: () => {} }));
    await waitFor(() => expect(first.result.current.view?.step).toBe('offer'));
    act(() => first.result.current.decline());
    expect(declined.marks).toEqual(['declined']);
    expect(first.result.current.view).toBeNull();

    const later = fakeBridge();
    const second = renderHook(() => useProfileMerge({ bridge: later.bridge, categoriesOf, onMerged: () => {} }));
    await waitFor(() => expect(second.result.current.view?.step).toBe('offer'));
    act(() => second.result.current.notNow());
    expect(later.marks).toEqual([]);
    expect(later.bridge.later).toHaveBeenCalled();
  });

  it('writes the done marker silently when nothing needs a copy', async () => {
    const { bridge, marks } = fakeBridge();
    const held = item('1');
    const categoriesOf = () => [category('a', [held], [], [held])];
    const { result } = renderHook(() => useProfileMerge({ bridge, categoriesOf, onMerged: () => {} }));
    await waitFor(() => expect(marks).toEqual(['done:a']));
    expect(result.current.view).toBeNull();
  });

  it('offers only the categories the done marker lacks', async () => {
    const { bridge, marks } = fakeBridge({ merged: ['a'] });
    const log: string[] = [];
    const categoriesOf = () => [category('a', [item('1')], log), category('b', [item('2')], log)];
    const { result } = renderHook(() => useProfileMerge({ bridge, categoriesOf, onMerged: () => {} }));
    await waitFor(() => expect(result.current.view?.step).toBe('offer'));
    expect(result.current.view?.step === 'offer' && result.current.view.plans.map((p) => p.key)).toEqual(['b']);
    await act(() => result.current.merge());
    expect(log).toEqual(['b:2']);
    expect(marks).toEqual(['done:b']);
  });

  it('opens nothing when every category was merged', async () => {
    const { bridge, marks } = fakeBridge({ merged: ['a'] });
    const source = vi.fn(async () => [item('1')]);
    const categoriesOf = () => [{ ...category('a', [], []), source }];
    const { result } = renderHook(() => useProfileMerge({ bridge, categoriesOf, onMerged: () => {} }));
    await waitFor(() => expect(bridge.offer).toHaveBeenCalled());
    await act(async () => {});
    expect(source).not.toHaveBeenCalled();
    expect(marks).toEqual([]);
    expect(result.current.view).toBeNull();
  });

  it('shows nothing when the main process reports no offer', async () => {
    const { bridge, marks } = fakeBridge(null);
    const categoriesOf = vi.fn(() => []);
    const { result } = renderHook(() => useProfileMerge({ bridge, categoriesOf, onMerged: () => {} }));
    await waitFor(() => expect(bridge.offer).toHaveBeenCalled());
    expect(categoriesOf).not.toHaveBeenCalled();
    expect(marks).toEqual([]);
    expect(result.current.view).toBeNull();
  });
});
