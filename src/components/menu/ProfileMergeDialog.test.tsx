import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProfileMergeDialog } from './ProfileMergeDialog';
import { useProfileMerge } from './useProfileMerge';
import { devProfileMergeView } from '@/lib/devProfileMergeSample';
import { MergeHalt, type MergeCategory, type MergeItem } from '@/lib/profileMerge/engine';
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
    expect(screen.getAllByRole('progressbar')).toHaveLength(8);
  });

  it.each(['offer', 'run'])('lists Avatars, Stat Templates and Mascot Images in the %s state', (step) => {
    render(<ProfileMergeDialog view={devProfileMergeView(step)} {...handlers()} />);
    for (const label of ['Avatars', 'Stat Templates', 'Mascot Images']) expect(screen.getByText(label)).toBeTruthy();
  });

  it('closes the offer on Escape as Not Now', () => {
    const h = handlers();
    render(<ProfileMergeDialog view={devProfileMergeView('offer')} {...h} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(h.onNotNow).toHaveBeenCalledOnce();
    expect(h.onDecline).not.toHaveBeenCalled();
  });

  it('asks for a restart only when the merge copied a settings key', () => {
    const onRestart = vi.fn();
    const result = (added: number) => ({
      step: 'result' as const,
      results: [{ key: 'settings', label: 'Settings and sign-in', added, replaced: 0, kept: 0, skipped: [] }],
    });
    const { rerender } = render(<ProfileMergeDialog view={result(2)} {...handlers()} onRestart={onRestart} />);
    expect(screen.getByText(/Restart Formamorph to use the settings/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(onRestart).toHaveBeenCalledOnce();
    rerender(<ProfileMergeDialog view={result(0)} {...handlers()} onRestart={onRestart} />);
    expect(screen.queryByRole('button', { name: 'Restart' })).toBeNull();
  });

  it('lists skipped items with reasons in the result', () => {
    render(<ProfileMergeDialog view={devProfileMergeView('result')} {...handlers()} />);
    expect(screen.getByText('Sedge Landing')).toBeTruthy();
    expect(screen.getByText(/enough storage space/)).toBeTruthy();
  });

  it('leaves out a category that had nothing to merge', () => {
    const empty = { key: 'models', label: 'Local Models', added: 0, replaced: 0, kept: 0, skipped: [] };
    const worlds = { key: 'worlds', label: 'Worlds', added: 1, replaced: 0, kept: 0, skipped: [] };
    render(<ProfileMergeDialog view={{ step: 'result', results: [worlds, empty] }} {...handlers()} />);
    expect(screen.getByText('Worlds')).toBeTruthy();
    expect(screen.queryByText('Local Models')).toBeNull();
  });

  it('lists a skipped local model with its reason in the result', () => {
    render(<ProfileMergeDialog view={devProfileMergeView('result')} {...handlers()} />);
    expect(screen.getByText('b.gguf')).toBeTruthy();
    expect(screen.getByText(/The file is in use/)).toBeTruthy();
  });

  it('shows local model progress as bytes moved against the total', () => {
    render(<ProfileMergeDialog view={devProfileMergeView('run')} {...handlers()} />);
    expect(screen.getByText('Local Models').nextSibling?.textContent).toBe('3.1 GB of 9.8 GB');
  });
});

const item = (id: string, size = 1): MergeItem => ({ id, label: id, stamp: '2026-06-01T00:00:00.000Z', size });

function fakeBridge(offer: { merged: string[] } | null = { merged: [] }) {
  const marks: string[] = [];
  const bridge: ProfileMergeBridge = {
    offer: vi.fn(async () => offer),
    summaries: vi.fn(async () => ({})),
    record: vi.fn(async () => null),
    settings: vi.fn(async () => ({})),
    modelFolder: vi.fn(async () => ({ source: {}, target: {} })),
    fillModelFolder: vi.fn(async () => {}),
    models: vi.fn(async () => ({ source: [], target: [] })),
    moveModel: vi.fn(async () => {}),
    restart: vi.fn(async () => {}),
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

  it('shows the result when the marker cannot be written after a full merge', async () => {
    const { bridge } = fakeBridge();
    const categoriesOf = () => [category('a', [item('1')], [])];
    const { result } = renderHook(() => useProfileMerge({ bridge, categoriesOf, onMerged: () => {} }));
    await waitFor(() => expect(result.current.view?.step).toBe('offer'));
    bridge.mark = vi.fn(async () => { throw new Error('The disk is full.'); });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(() => result.current.merge());
    expect(result.current.view).toMatchObject({ step: 'result', results: [{ key: 'a', added: 1 }] });
    expect(result.current.view).not.toHaveProperty('error');
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it('shows the stop reason when a copy halts the run', async () => {
    const { bridge } = fakeBridge();
    const halting = { ...category('a', [item('1')], []), copy: async () => { throw new MergeHalt('The other copy stopped answering (The window closed)'); } };
    const categoriesOf = () => [halting];
    const { result } = renderHook(() => useProfileMerge({ bridge, categoriesOf, onMerged: () => {} }));
    await waitFor(() => expect(result.current.view?.step).toBe('offer'));
    await act(() => result.current.merge());
    expect(result.current.view).toMatchObject({ step: 'result', error: 'The other copy stopped answering (The window closed)' });
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
