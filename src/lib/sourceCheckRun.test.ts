import { describe, it, expect, vi } from 'vitest';
import { runSourceCheck, type SourceCheckPorts } from './sourceCheckRun';
import { linkedSourceCopies, type SourceCheckWorld } from './sourceChecks';
import type { DependencyRow } from './worldDependencies';
import type { Entity } from '@/types';

const entity = (id: string, name: string, link?: Entity['link']): Entity =>
  ({ id, name, ...(link ? { link } : {}) }) as Entity;

const world: SourceCheckWorld = {
  entities: [
    entity('e1', 'Warden', { sourceId: 'src-a', sourceName: 'Marsh Warden' }),
    entity('e2', 'Herald', { sourceId: 'src-b', sourceName: 'Fen Herald' }),
  ],
};

const copies = linkedSourceCopies(world);

const dependency = (id: string, status: DependencyRow['status']): DependencyRow => ({ id, status });

/** Ports that answer from two lookup tables. */
const ports = (sources: Record<string, 'ok' | 'not_found' | 'unavailable'>, deps: DependencyRow[] = []): SourceCheckPorts => ({
  dependencies: vi.fn().mockResolvedValue(deps),
  source: vi.fn(async (id: string) => sources[id] ?? 'ok'),
});

describe('runSourceCheck', () => {
  it('asks about nothing when the world follows no published source', async () => {
    const p = ports({});
    const record = await runSourceCheck([], 'world-1', p);
    expect(record.results).toEqual({});
    expect(p.source).not.toHaveBeenCalled();
  });

  it('asks each source directly for a world that was never published', async () => {
    const record = await runSourceCheck(copies, null, ports({ 'src-a': 'not_found', 'src-b': 'ok' }));
    expect(record.results).toEqual({ 'src-a': 'not_found', 'src-b': 'ok' });
    expect(record.required).toEqual([]);
  });

  it('takes the required set and its answers from the world’s own listing', async () => {
    const p = ports({ 'world-1': 'ok', 'src-b': 'ok' }, [dependency('src-a', 'not_found')]);
    const record = await runSourceCheck(copies, 'world-1', p);

    expect(record.required).toEqual(['src-a']);
    expect(record.results).toEqual({ 'src-a': 'not_found', 'src-b': 'ok' });
    // The required source is answered by the listing, so it is never asked about directly — a direct ask
    // would answer not found for an unlisted source that is perfectly well there.
    expect(p.source).not.toHaveBeenCalledWith('src-a');
  });

  it('concludes nothing when the world’s own listing cannot be read', async () => {
    const p = ports({ 'world-1': 'unavailable', 'src-a': 'not_found' });
    const record = await runSourceCheck(copies, 'world-1', p, ['src-a']);

    expect(record.results).toEqual({ 'src-a': 'unavailable', 'src-b': 'unavailable' });
    expect(record.required).toEqual(['src-a']);
    expect(p.dependencies).not.toHaveBeenCalled();
  });

  it('concludes nothing when the world’s own listing is gone, rather than calling its sources removed', async () => {
    const record = await runSourceCheck(copies, 'world-1', ports({ 'world-1': 'not_found' }), ['src-a']);
    expect(record.results).toEqual({ 'src-a': 'unavailable', 'src-b': 'unavailable' });
  });

  it('concludes nothing when the required set cannot be read', async () => {
    const p: SourceCheckPorts = {
      dependencies: vi.fn().mockRejectedValue(new Error('offline')),
      source: vi.fn(async (id: string) => (id === 'world-1' ? 'ok' : 'not_found')),
    };
    const record = await runSourceCheck(copies, 'world-1', p, ['src-a']);
    expect(record.results).toEqual({ 'src-a': 'unavailable', 'src-b': 'unavailable' });
  });

  it('reports a network failure on one source as unreachable, not as removed', async () => {
    const record = await runSourceCheck(copies, null, ports({ 'src-a': 'unavailable', 'src-b': 'ok' }));
    expect(record.results).toEqual({ 'src-a': 'unavailable', 'src-b': 'ok' });
  });

  it('asks about one source once however many copies follow it', async () => {
    const shared: SourceCheckWorld = {
      entities: [
        entity('e1', 'One', { sourceId: 'src-a', sourceName: 'Marsh Warden' }),
        entity('e2', 'Two', { sourceId: 'src-a', sourceName: 'Marsh Warden' }),
      ],
    };
    const p = ports({ 'src-a': 'not_found' });
    await runSourceCheck(linkedSourceCopies(shared), null, p);
    expect(p.source).toHaveBeenCalledTimes(1);
  });

  it('ignores a required source no copy in this world follows', async () => {
    const p = ports({ 'world-1': 'ok', 'src-a': 'ok', 'src-b': 'ok' }, [dependency('src-z', 'not_found')]);
    const record = await runSourceCheck(copies, 'world-1', p);
    expect(record.results).toEqual({ 'src-a': 'ok', 'src-b': 'ok' });
    expect(record.required).toEqual(['src-z']);
  });

  it('stamps the run', async () => {
    const record = await runSourceCheck(copies, null, ports({}));
    expect(Date.parse(record.checkedAt)).not.toBeNaN();
  });
});
