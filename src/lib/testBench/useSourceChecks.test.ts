import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSourceChecks } from './useSourceChecks';
import { readSourceCheck, writeSourceCheck } from '@/lib/sourceCheckStore';
import type { SourceCheckPorts } from '@/lib/sourceCheckRun';
import type { SourceCheckWorld } from '@/lib/sourceChecks';
import type { Entity } from '@/types';

const entity = (id: string, name: string, link?: Entity['link']): Entity =>
  ({ id, name, ...(link ? { link } : {}) }) as Entity;

const world: SourceCheckWorld = {
  entities: [entity('e1', 'Warden', { sourceId: 'src-a', sourceName: 'Marsh Warden' })],
};

const ports = (status: 'ok' | 'not_found' | 'unavailable'): SourceCheckPorts => ({
  dependencies: vi.fn().mockResolvedValue([]),
  source: vi.fn().mockResolvedValue(status),
});

const render = (p: SourceCheckPorts, worldId = 'w1') =>
  renderHook(() => useSourceChecks(world, worldId, undefined, p));

describe('useSourceChecks', () => {
  beforeEach(() => localStorage.clear());

  it('starts idle and reports nothing missing before anyone asks', () => {
    const { result } = render(ports('not_found'));
    expect(result.current.status).toBe('idle');
    expect(result.current.missing).toEqual([]);
    expect(result.current.findings).toEqual([]);
  });

  it('never asks the server on its own', () => {
    const p = ports('not_found');
    render(p);
    expect(p.source).not.toHaveBeenCalled();
  });

  it('reports the removed source after the author asks, and records the answer', async () => {
    const { result } = render(ports('not_found'));
    act(() => result.current.run());

    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.missing).toMatchObject([{ id: 'e1', status: 'not_found' }]);
    expect(result.current.findings.map((f) => f.ruleId)).toEqual(['source-not-found']);
    expect(readSourceCheck('w1').results).toEqual({ 'src-a': 'not_found' });
  });

  it('reports a failed check as unreachable', async () => {
    const { result } = render(ports('unavailable'));
    act(() => result.current.run());

    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.findings.map((f) => f.ruleId)).toEqual(['source-unavailable']);
  });

  it('clears the finding when a later check answers', async () => {
    writeSourceCheck('w1', { checkedAt: 'T1', results: { 'src-a': 'not_found' }, required: [] });
    const { result } = render(ports('ok'));
    expect(result.current.missing).toHaveLength(1);

    act(() => result.current.run());
    await waitFor(() => expect(result.current.missing).toEqual([]));
  });

  it('reads the stored answer back, so the row survives a reopen', () => {
    writeSourceCheck('w1', { checkedAt: 'T1', results: { 'src-a': 'not_found' }, required: ['src-a'] });
    const { result } = render(ports('ok'));

    expect(result.current.status).toBe('done');
    expect(result.current.missing).toMatchObject([{ id: 'e1', status: 'not_found', required: true }]);
  });

  it('keeps one world’s answer out of another’s', () => {
    writeSourceCheck('w1', { checkedAt: 'T1', results: { 'src-a': 'not_found' }, required: [] });
    const { result } = render(ports('ok'), 'w2');
    expect(result.current.missing).toEqual([]);
  });

  it('lists every copy that follows a published source, checked or not', () => {
    const { result } = render(ports('ok'));
    expect(result.current.copies.map((c) => c.sourceId)).toEqual(['src-a']);
  });
});
